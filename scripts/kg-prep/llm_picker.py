#!/usr/bin/env python3
"""
LLMPicker — choose one ActionCandidate from KG-ranked list.

Two modes:
  - "anthropic" (default if ANTHROPIC_API_KEY env present): Claude picks from
    the candidate list, given current state context. Uses claude-sonnet-4-6.
  - "greedy" (fallback): always pick lowest-cost candidate. Useful for unit
    tests and ablation experiments isolating the KG planner from the LLM.

The LLM is *constrained* to return the index of a candidate (or "abstain").
We do NOT let it free-form an action — that would defeat the KG's planning
contribution. The LLM's job here is local prioritisation given state context
the KG cost formula doesn't capture (e.g. "we already tried T1572 last step
and it failed; pick T1571 instead").
"""

from __future__ import annotations
import json
import os
from typing import Optional


# Defer heavy import until used.
def _get_anthropic_client():
    try:
        import anthropic
    except ImportError as e:
        raise RuntimeError("pip install anthropic") from e
    return anthropic.Anthropic()


# ─── Pickers ─────────────────────────────────────────────────────────────────

class GreedyPicker:
    """Always pick the lowest-cost candidate. Used as fallback or for ablation.

    Sorts defensively in case the caller passed an unsorted list; KGClient
    already returns ORDER BY cost ASC so this is a no-op in the normal path.
    """
    name = "greedy"

    def pick(self, state, candidates, target=None):
        if not candidates:
            return None
        return min(candidates, key=lambda c: c.cost)


class AnthropicPicker:
    """Claude-based local prioritisation over KG candidates.

    Prompt design intentionally exposes:
      - Current state (completed T-IDs, privilege)
      - Recent failure history (avoid retrying the same failing tactic)
      - The ranked candidate list from KG (cost, executor, command preview)

    The model returns a JSON object with `index` (int) or `abstain` (bool).
    Anything else is treated as abstention → fall back to GreedyPicker.
    """
    name = "anthropic"

    SYSTEM = (
        "You are the local action selector for an autonomous red-team agent. "
        "The Knowledge Graph has produced a ranked list of viable next actions "
        "(lowest cost first). Your job is to pick ONE index from the list "
        "given the current state, OR abstain if none look right. "
        "You MUST respond with a single JSON object: "
        '{"index": <int>, "reason": "<one-sentence>"} OR '
        '{"abstain": true, "reason": "<one-sentence>"}. '
        "No prose outside the JSON."
    )

    def __init__(self, model: str = "claude-sonnet-4-6",
                 max_tokens: int = 200,
                 recent_failures: Optional[list[str]] = None) -> None:
        self.model = model
        self.max_tokens = max_tokens
        self.recent_failures = recent_failures or []
        self._client = None    # lazy init

    def pick(self, state, candidates, target=None):
        if not candidates:
            return None
        if self._client is None:
            self._client = _get_anthropic_client()

        prompt = self._build_prompt(state, candidates, target)
        try:
            msg = self._client.messages.create(
                model=self.model,
                max_tokens=self.max_tokens,
                system=self.SYSTEM,
                messages=[{"role": "user", "content": prompt}],
            )
            raw = msg.content[0].text if msg.content else ""
            decision = self._parse(raw)
        except Exception as e:
            # Network error / rate limit / parse failure → fall back to greedy.
            return GreedyPicker().pick(state, candidates, target)

        if decision is None or decision.get("abstain"):
            return None
        idx = decision.get("index")
        if not isinstance(idx, int) or idx < 0 or idx >= len(candidates):
            return GreedyPicker().pick(state, candidates, target)
        return candidates[idx]

    def _build_prompt(self, state, candidates, target) -> str:
        lines = ["## Current state"]
        completed = sorted(state.completed_techniques) if state.completed_techniques else []
        lines.append(f"completed_techniques: {completed}")
        lines.append(f"current_privilege: {state.current_privilege}")
        if target is not None:
            lines.append(f"target_host: {getattr(target, 'host', '<unknown>')}")
        if self.recent_failures:
            lines.append(f"recent_failed_actions: {self.recent_failures}")

        lines.append("")
        lines.append("## Candidates (KG-ranked, lowest cost first)")
        for i, c in enumerate(candidates):
            cmd = (c.command_template or "")[:80].replace("\n", " ")
            roe = " [RoE]" if c.roe_required else ""
            lines.append(
                f"{i}. {c.action_name} → {c.next_technique_id} "
                f"(cost={c.cost:.2f}, {c.executor}){roe}"
            )
            lines.append(f"   cmd: {cmd}")
        lines.append("")
        lines.append('Respond with JSON only: {"index": <int>, "reason": "..."}')
        return "\n".join(lines)

    @staticmethod
    def _parse(raw: str) -> Optional[dict]:
        raw = raw.strip()
        # Try direct JSON first; some models wrap in markdown.
        for candidate in (raw,
                          raw.removeprefix("```json").removesuffix("```"),
                          raw.removeprefix("```").removesuffix("```")):
            try:
                return json.loads(candidate.strip())
            except (json.JSONDecodeError, AttributeError):
                continue
        return None


# ─── Factory ─────────────────────────────────────────────────────────────────

def make_picker(mode: Optional[str] = None,
                recent_failures: Optional[list[str]] = None):
    """Pick the right picker based on env / explicit arg.

    Resolution order:
      1. explicit `mode` arg ("greedy" or "anthropic")
      2. LLM_PICKER env var
      3. anthropic if ANTHROPIC_API_KEY in env
      4. greedy otherwise
    """
    chosen = (mode
              or os.environ.get("LLM_PICKER")
              or ("anthropic" if os.environ.get("ANTHROPIC_API_KEY") else "greedy"))
    if chosen == "anthropic":
        return AnthropicPicker(recent_failures=recent_failures)
    return GreedyPicker()


# ─── Smoke test ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    from dataclasses import dataclass

    @dataclass
    class FakeCandidate:
        action_name: str
        next_technique_id: str
        cost: float
        executor: str = "bash"
        command_template: str = ""
        roe_required: bool = False

    @dataclass
    class FakeState:
        completed_techniques: set
        current_privilege: str = "user"

    cands = [
        FakeCandidate("webshell_drop", "T1505.003", 0.30),
        FakeCandidate("schtasks_persist", "T1053.005", 0.20),
        FakeCandidate("ad_account_add", "T1098", 0.10),
    ]
    state = FakeState(completed_techniques={"T1078"}, current_privilege="domain_admin")

    print("=== GreedyPicker (always lowest cost) ===")
    p = GreedyPicker()
    chosen = p.pick(state, cands)
    print(f"chose: {chosen.action_name}  (expected ad_account_add)")
    assert chosen.action_name == "ad_account_add"
    print("OK\n")

    print("=== make_picker() resolution ===")
    p = make_picker(mode="greedy")
    print(f"  explicit 'greedy' → {p.name}")
    p = make_picker()
    print(f"  default (no env)  → {p.name}")
    print(f"  set ANTHROPIC_API_KEY to test the Anthropic path")
