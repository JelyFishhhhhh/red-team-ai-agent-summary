#!/usr/bin/env python3
"""
KGClient — Python API for the APT-GPT Attack Knowledge Graph.

This is the plug-in surface that MARS-2's reasoning loop calls each cycle:
given the agent's current state and goal, return the ranked list of viable
next actions. The implementation is a thin wrapper around the Cypher planner
query defined in Cost-Function-Methodology.md §1.

Usage from MARS-2:

    from kg_client import KGClient, AgentState

    kg = KGClient()              # reads NEO4J_URI/USERNAME/PASSWORD from env
    state = AgentState(
        completed_techniques={"T1190", "T1505.003"},
        current_privilege="user",
        compromised_hosts=["10.0.0.5"],
    )
    candidates = kg.get_next_actions(state, goal="persistence")
    for c in candidates[:3]:
        print(c.action_name, c.next_technique_id, c.cost)

CLI smoke-test:
    python kg_client.py --state T1078 --goal domain_admin
"""

from __future__ import annotations
import os
import sys
from dataclasses import dataclass, field
from typing import Iterable, Optional


# ─── Data models ─────────────────────────────────────────────────────────────

@dataclass
class AgentState:
    """The slice of MARS-2 reasoning state the KG needs to answer planning
    queries. Designed to be a minimal contract — MARS-2 maintains its own
    rich state model; we only pull the fields relevant to KG inference."""
    completed_techniques: set[str] = field(default_factory=set)
    current_privilege: str = "user"            # none / user / admin / root / domain_admin
    has_network_access: bool = True
    has_outbound_http: bool = True
    compromised_hosts: list[str] = field(default_factory=list)

    @property
    def last_completed(self) -> Optional[str]:
        """Most recently completed technique — drives LEADS_TO traversal."""
        if not self.completed_techniques:
            return None
        # MARS-2 should track insertion order via a list; fall back here
        return next(iter(self.completed_techniques))


@dataclass
class ActionCandidate:
    """One viable next action returned by the planner."""
    action_uuid: str
    action_name: str
    next_technique_id: str
    next_technique_name: Optional[str]
    cost: float
    executor: str
    privilege_required: str
    command_template: Optional[str]
    enrichment_quality: str
    roe_required: bool

    def __repr__(self) -> str:
        roe = " [RoE]" if self.roe_required else ""
        return (f"<ActionCandidate {self.action_name} "
                f"→ {self.next_technique_id} cost={self.cost:.3f}{roe}>")


# ─── Planner queries ─────────────────────────────────────────────────────────

# Q1: Tactic-loop main query — given last_completed, find next techniques
#     and their cheapest implementing actions, ranked by composite cost.
Q_NEXT_ACTIONS = """
MATCH (current:Technique {id: $last_tid})-[:LEADS_TO]->(next:Technique)
OPTIONAL MATCH (next)<-[:IMPLEMENTS]-(a:AttackAction)
WHERE a.privilege IN $allowed_privs
RETURN a.uuid AS uuid,
       a.name AS name,
       next.id AS next_tid,
       next.name AS next_name,
       a.cost AS cost,
       a.executor AS executor,
       a.privilege AS privilege,
       a.command_template AS command,
       a.enrichment_quality AS quality,
       a.rules_of_engagement_required AS roe
ORDER BY cost ASC
LIMIT $limit
"""

# Q2: Cold-start query — when last_completed is None, suggest entrypoints
#     (techniques in Initial Access tactic).
Q_COLD_START = """
MATCH (a:AttackAction)-[:IMPLEMENTS]->(t:Technique)-[:BELONGS_TO]->(:Tactic {id: "TA0001"})
WHERE a.privilege IN $allowed_privs
RETURN a.uuid AS uuid,
       a.name AS name,
       t.id AS next_tid,
       t.name AS next_name,
       a.cost AS cost,
       a.executor AS executor,
       a.privilege AS privilege,
       a.command_template AS command,
       a.enrichment_quality AS quality,
       a.rules_of_engagement_required AS roe
ORDER BY cost ASC
LIMIT $limit
"""

# Q3: Reachability check — can we reach a goal Tactic from the current state?
Q_REACHABILITY = """
MATCH path = (start:Technique {id: $start_tid})-[:LEADS_TO*1..8]->(end:Technique)-[:BELONGS_TO]->(:Tactic {id: $goal_tactic})
RETURN [n IN nodes(path) | n.id] AS chain
LIMIT 1
"""


# Privilege ordering used to filter actions the agent could not execute
# (e.g. agent has "user" priv, can't run an admin-required action).
PRIVILEGE_REACHABLE = {
    "none": {"none"},
    "user": {"none", "user"},
    "admin": {"none", "user", "admin", "root"},
    "root": {"none", "user", "admin", "root"},
    "domain_admin": {"none", "user", "admin", "root", "domain_admin"},
}


# ─── Client ─────────────────────────────────────────────────────────────────

class KGClient:
    """Thin synchronous wrapper around the Neo4j driver, exposing planning
    primitives at the granularity MARS-2 needs."""

    def __init__(self,
                 uri: Optional[str] = None,
                 user: Optional[str] = None,
                 password: Optional[str] = None) -> None:
        try:
            from neo4j import GraphDatabase, basic_auth
        except ImportError as e:
            raise RuntimeError("pip install neo4j") from e

        self._uri = uri or os.environ.get("NEO4J_URI", "bolt://localhost:7687")
        self._user = (user
                      or os.environ.get("NEO4J_USERNAME")
                      or os.environ.get("NEO4J_USER", "neo4j"))
        self._password = password or os.environ.get("NEO4J_PASSWORD", "")
        if not self._password:
            raise RuntimeError("NEO4J_PASSWORD env var required")

        self._driver = GraphDatabase.driver(
            self._uri, auth=basic_auth(self._user, self._password)
        )

    def close(self) -> None:
        self._driver.close()

    def __enter__(self) -> "KGClient":
        return self

    def __exit__(self, *args) -> None:
        self.close()

    # ─── Public planning API ────────────────────────────────────────────────

    def get_next_actions(self,
                         state: AgentState,
                         goal: Optional[str] = None,
                         limit: int = 10) -> list[ActionCandidate]:
        """Return ranked list of viable next actions given current state.

        Ranking: ascending cost (composite formula per Methodology §3).
        Filtering: only actions whose privilege requirement is reachable
                   from the agent's current privilege.

        If state.last_completed is None (cold start), returns Initial Access
        candidates instead of LEADS_TO traversal.
        """
        allowed = list(PRIVILEGE_REACHABLE.get(state.current_privilege, {"user"}))
        last = state.last_completed

        with self._driver.session() as session:
            if last:
                result = session.run(Q_NEXT_ACTIONS,
                                     last_tid=last,
                                     allowed_privs=allowed,
                                     limit=limit)
            else:
                result = session.run(Q_COLD_START,
                                     allowed_privs=allowed,
                                     limit=limit)
            return [self._row_to_candidate(r) for r in result]

    def is_goal_reachable(self,
                          state: AgentState,
                          goal_tactic_id: str) -> tuple[bool, list[str]]:
        """Check whether the goal Tactic is reachable from the current state.

        Returns (reachable, chain) where chain is the T-ID sequence that
        would get the agent there (empty if unreachable).
        """
        last = state.last_completed
        if not last:
            return False, []
        with self._driver.session() as session:
            for record in session.run(Q_REACHABILITY,
                                      start_tid=last,
                                      goal_tactic=goal_tactic_id):
                return True, list(record["chain"])
        return False, []

    def technique_coverage(self) -> dict[str, int]:
        """Return AttackAction count per Tactic. Useful for paper §6 stats."""
        with self._driver.session() as session:
            result = session.run("""
                MATCH (a:AttackAction)-[:IMPLEMENTS]->(:Technique)-[:BELONGS_TO]->(t:Tactic)
                RETURN t.id AS tactic, count(a) AS actions
                ORDER BY tactic
            """)
            return {r["tactic"]: r["actions"] for r in result}

    # ─── Internals ──────────────────────────────────────────────────────────

    @staticmethod
    def _row_to_candidate(row) -> ActionCandidate:
        return ActionCandidate(
            action_uuid=row["uuid"] or "",
            action_name=row["name"] or "",
            next_technique_id=row["next_tid"] or "",
            next_technique_name=row.get("next_name"),
            cost=float(row["cost"]) if row.get("cost") is not None else 1.0,
            executor=row.get("executor") or "bash",
            privilege_required=row.get("privilege") or "user",
            command_template=row.get("command"),
            enrichment_quality=row.get("quality") or "default",
            roe_required=bool(row.get("roe", False)),
        )


# ─── CLI smoke-test ──────────────────────────────────────────────────────────

def _cli() -> int:
    import argparse, json
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--state", default=None,
                    help="Most recently completed T-ID (e.g. T1078). "
                         "Empty triggers cold-start (Initial Access) query.")
    ap.add_argument("--privilege", default="user",
                    choices=["none", "user", "admin", "root", "domain_admin"])
    ap.add_argument("--goal", default=None,
                    help="Goal Tactic ID for reachability check (e.g. TA0040)")
    ap.add_argument("--limit", type=int, default=5)
    args = ap.parse_args()

    state = AgentState(
        completed_techniques={args.state} if args.state else set(),
        current_privilege=args.privilege,
    )

    with KGClient() as kg:
        print(f"\n=== Coverage summary ===")
        cov = kg.technique_coverage()
        for tactic, count in cov.items():
            print(f"  {tactic}: {count} actions")
        print(f"  TOTAL across {len(cov)} tactics: {sum(cov.values())} actions")

        print(f"\n=== Next actions from state={args.state!r} priv={args.privilege} ===")
        for c in kg.get_next_actions(state, goal=args.goal, limit=args.limit):
            print(f"  {c}")
            if c.command_template:
                cmd = c.command_template.replace("\n", " ").strip()
                print(f"      cmd: {cmd[:90]}{'...' if len(cmd) > 90 else ''}")

        if args.goal and args.state:
            print(f"\n=== Reachability: {args.state} → {args.goal}? ===")
            reachable, chain = kg.is_goal_reachable(state, args.goal)
            if reachable:
                print(f"  YES via: {' → '.join(chain)}")
            else:
                print("  NO direct path in current KG")

    return 0


if __name__ == "__main__":
    sys.exit(_cli())
