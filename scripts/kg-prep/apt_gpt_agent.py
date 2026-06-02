#!/usr/bin/env python3
"""
APTGPTAgent — standalone attacking agent built around the KG.

Reasoning loop:
  for step in range(max_steps):
      candidates = kg_client.get_next_actions(state)
      chosen    = llm_picker.pick(state, candidates)
      result    = executor_router.dispatch(chosen, target)
      state.update(chosen, result)
  return summary

The whole point is that this is ~200 LOC the user owns end-to-end, decoupled
from MARS-2's if-else exploit logic (see wiki/APT-GPT/MARS2-Decoupling-Decision).

Run modes:
  --dry-run     KG fetch + LLM pick + router rendering, but no real execution
                (every Executor returns ExecutionResult.skipped()). Useful for
                pipeline tests without a live lab.
  default       Real execution. Requires:
                  - NEO4J_URI/USERNAME/PASSWORD env (or .env)
                  - SSH credentials on the target (for BashExecutor SSH path)
                  - ANTHROPIC_API_KEY env (for AnthropicPicker), else greedy
"""

from __future__ import annotations
import argparse
import json
import os
import sys
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Optional

# Local module imports
sys.path.insert(0, str(Path(__file__).parent))
from kg_client import KGClient, AgentState, ActionCandidate          # noqa: E402
from executor_router import ExecutorRouter, TargetContext, ExecutionResult  # noqa: E402
from llm_picker import make_picker                                    # noqa: E402


# ─── Per-step log ────────────────────────────────────────────────────────────

@dataclass
class StepLog:
    step: int
    chosen_action: str
    technique_id: str
    cost: float
    executor: str
    success: bool
    stdout_preview: str = ""
    stderr_preview: str = ""
    skipped_reason: Optional[str] = None


# ─── Tactic id ↔ first 4 digit prefix of T-ID (rough heuristic) ─────────────
# Used by _goal_reached to detect "has any executed technique reached the
# goal Tactic". This relies on the KG already mapping T-IDs to Tactics, so
# the heuristic is only consulted when we need a quick check without a Cypher
# round-trip.

TACTIC_PREFIXES: dict[str, set[str]] = {
    "TA0003": {"T1053", "T1098", "T1136", "T1505", "T1547"},
    "TA0011": {"T1071", "T1090", "T1095", "T1105", "T1132",
               "T1571", "T1572", "T1573"},
    "TA0040": {"T1485", "T1486", "T1489", "T1490", "T1531"},
    "TA0004": {"T1068", "T1134", "T1548"},
    "TA0042": {"T1583", "T1584", "T1585", "T1586", "T1587", "T1588"},
    # Add more as KG grows.
}


# ─── Agent ──────────────────────────────────────────────────────────────────

class APTGPTAgent:
    def __init__(self,
                 kg: KGClient,
                 router: ExecutorRouter,
                 picker,
                 target: TargetContext,
                 verbose: bool = True) -> None:
        self.kg = kg
        self.router = router
        self.picker = picker
        self.target = target
        self.state = AgentState()
        self.history: list[StepLog] = []
        self._recent_failures: list[str] = []
        self.verbose = verbose

    # ─── Public API ─────────────────────────────────────────────────────────

    def run(self, max_steps: int = 10,
            goal_tactic: Optional[str] = None) -> dict:
        for step in range(max_steps):
            self._log_state(step)

            candidates = self.kg.get_next_actions(self.state, limit=5)
            if not candidates:
                self._log(f"[step {step}] KG returned no candidates; stopping.")
                break

            chosen = self.picker.pick(self.state, candidates, target=self.target)
            if chosen is None:
                self._log(f"[step {step}] LLM abstained; stopping.")
                break

            self._log(f"[step {step}] picked {chosen.action_name} → "
                      f"{chosen.next_technique_id} (cost={chosen.cost:.3f}, "
                      f"executor={chosen.executor})")

            result = self.router.dispatch(chosen, self.target)
            log = self._record_step(step, chosen, result)
            self._log(f"           result: success={log.success} "
                      f"{log.skipped_reason or ''}")

            self.state.mark_completed(chosen.next_technique_id)
            if not result.success:
                self._recent_failures.append(chosen.action_name)
                # Keep last 3 failures; the picker can use them next round.
                self._recent_failures = self._recent_failures[-3:]

            if goal_tactic and self._goal_reached(goal_tactic):
                self._log(f"[step {step}] goal Tactic {goal_tactic} reached; "
                          f"stopping.")
                break

        return self._summarise()

    # ─── Internals ──────────────────────────────────────────────────────────

    def _record_step(self, step: int, chosen: ActionCandidate,
                     result: ExecutionResult) -> StepLog:
        log = StepLog(
            step=step,
            chosen_action=chosen.action_name,
            technique_id=chosen.next_technique_id,
            cost=chosen.cost,
            executor=result.executor_name or chosen.executor,
            success=result.success,
            stdout_preview=(result.stdout or "")[:200],
            stderr_preview=(result.stderr or "")[:200],
            skipped_reason=result.skipped_reason,
        )
        self.history.append(log)
        return log

    def _goal_reached(self, tactic: str) -> bool:
        prefixes = TACTIC_PREFIXES.get(tactic, set())
        for tid in self.state.completed_techniques:
            parent = tid.split(".")[0]
            if parent in prefixes:
                return True
        return False

    def _summarise(self) -> dict:
        successes = sum(1 for h in self.history if h.success)
        return {
            "steps_taken": len(self.history),
            "successful_steps": successes,
            "completed_techniques": sorted(self.state.completed_techniques),
            "final_privilege": self.state.current_privilege,
            "history": [asdict(h) for h in self.history],
        }

    def _log(self, msg: str) -> None:
        if self.verbose:
            print(msg, flush=True)

    def _log_state(self, step: int) -> None:
        if self.verbose:
            done = ",".join(sorted(self.state.completed_techniques)) or "(none)"
            self._log(f"--- step {step}: completed={done} "
                      f"priv={self.state.current_privilege} ---")


# ─── CLI ────────────────────────────────────────────────────────────────────

def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--target", required=True,
                    help="Target host IP or hostname")
    ap.add_argument("--ssh-user", default=None)
    ap.add_argument("--ssh-password", default=None)
    ap.add_argument("--ssh-key", default=None)
    ap.add_argument("--ssh-port", type=int, default=22)
    ap.add_argument("--max-steps", type=int, default=10)
    ap.add_argument("--goal-tactic", default=None,
                    help="Stop early when any technique under this Tactic completes")
    ap.add_argument("--dry-run", action="store_true",
                    help="Don't execute commands; surface what would happen")
    ap.add_argument("--picker", choices=["greedy", "anthropic"], default=None,
                    help="Override LLM picker mode (else auto-detect via env)")
    ap.add_argument("--initial-state", default=None,
                    help="Comma-separated T-IDs already completed "
                         '(e.g. "T1190,T1505.003")')
    ap.add_argument("--privilege", default="user",
                    choices=["none", "user", "admin", "root", "domain_admin"])
    ap.add_argument("--summary-out", default=None,
                    help="Write summary JSON to this path")
    args = ap.parse_args()

    target = TargetContext(
        host=args.target,
        ssh_user=args.ssh_user,
        ssh_password=args.ssh_password,
        ssh_key_path=args.ssh_key,
        ssh_port=args.ssh_port,
    )

    router = ExecutorRouter.with_defaults(dry_run=args.dry_run)
    picker = make_picker(mode=args.picker)

    with KGClient() as kg:
        agent = APTGPTAgent(kg=kg, router=router, picker=picker, target=target)

        if args.initial_state:
            for tid in args.initial_state.split(","):
                tid = tid.strip()
                if tid:
                    agent.state.mark_completed(tid)
        agent.state.current_privilege = args.privilege

        summary = agent.run(max_steps=args.max_steps,
                            goal_tactic=args.goal_tactic)

    print("\n=== Summary ===")
    print(f"steps_taken: {summary['steps_taken']}  "
          f"successful: {summary['successful_steps']}")
    print(f"completed: {summary['completed_techniques']}")
    print(f"final_priv: {summary['final_privilege']}")

    if args.summary_out:
        Path(args.summary_out).write_text(
            json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8"
        )
        print(f"\nSummary written to {args.summary_out}")

    return 0 if summary["steps_taken"] > 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
