#!/usr/bin/env python3
"""
Batch import PDDL AttackAction nodes into Neo4j.

Accepts:
  - Hand-written 11 seed nodes (kg-seed-nodes.cypher equivalent in JSON)
  - AttacKG-derived nodes (from attackg_to_pddl.py)

Creates / merges:
  (:Tactic) and (:Technique) hierarchy
  (:AttackAction) with PDDL preconditions/effects
  (:Precondition) atomic state predicates
  Edges: BELONGS_TO, IMPLEMENTS, REQUIRES, LEADS_TO, ENABLES

Connection (env-var first, CLI override available):
  NEO4J_URI       e.g. bolt://10.0.0.5:7687 or neo4j+s://aura.host
  NEO4J_USER      default: neo4j
  NEO4J_PASSWORD  required

Usage:
  pip install neo4j
  export NEO4J_URI=bolt://<remote-host>:7687
  export NEO4J_PASSWORD=<password>

  python import_to_neo4j.py \\
      --seed     ./seed_nodes.json       # the 11 hand-written PDDL nodes
      --attackg  ./out/pddl_nodes.json   # output from attackg_to_pddl.py
      [--dry-run]                         # log queries, no writes
      [--batch-size 500]
"""

from __future__ import annotations
import argparse
import json
import os
import sys
from pathlib import Path
from typing import Iterable

# Lazy-imported inside run_import() so --dry-run works without the driver
# installed (useful for sanity-checking the pipeline before provisioning Neo4j).


# ─── ATT&CK Tactic metadata (for MERGE on first import) ──────────────────────

TACTIC_NAMES = {
    "TA0043": "Reconnaissance",
    "TA0042": "Resource Development",
    "TA0001": "Initial Access",
    "TA0002": "Execution",
    "TA0003": "Persistence",
    "TA0004": "Privilege Escalation",
    "TA0005": "Defense Evasion",
    "TA0006": "Credential Access",
    "TA0007": "Discovery",
    "TA0008": "Lateral Movement",
    "TA0009": "Collection",
    "TA0010": "Exfiltration",
    "TA0011": "Command and Control",
    "TA0040": "Impact",
}


# ─── LEADS_TO edges from KG-Extension-EasyWins (the 9-step Persistence + C2 + Impact chain) ──

DEFAULT_LEADS_TO_EDGES: list[tuple[str, str]] = [
    # Initial Access -> Persistence
    ("T1190", "T1505.003"),
    # Persistence -> C2
    ("T1505.003", "T1572"),
    ("T1572", "T1105"),
    # Credential Access chain
    ("T1558.003", "T1078"),
    ("T1078", "T1098"),
    ("T1078", "T1547.001"),
    # C2 -> Impact
    ("T1105", "T1489"),
]

DEFAULT_REQUIRES_EDGES: list[tuple[str, str]] = [
    ("T1098", "T1078"),         # AD account add requires valid creds
    ("T1547.001", "T1078"),     # Registry Run needs user session
    ("T1572", "T1505.003"),     # Tunnel needs initial RCE
]


# ─── Cypher templates ────────────────────────────────────────────────────────

CREATE_INDEXES = [
    "CREATE INDEX tactic_id IF NOT EXISTS FOR (t:Tactic) ON (t.id)",
    "CREATE INDEX technique_id IF NOT EXISTS FOR (t:Technique) ON (t.id)",
    "CREATE INDEX action_uuid IF NOT EXISTS FOR (a:AttackAction) ON (a.uuid)",
    "CREATE INDEX precondition_key IF NOT EXISTS FOR (p:Precondition) ON (p.key)",
]

MERGE_TACTIC = "MERGE (t:Tactic {id: $id}) SET t.name = $name"

# AttackAction MERGE writes all PDDL fields as properties
MERGE_ACTION = """
MERGE (t:Tactic {id: $tactic_id})
MERGE (te:Technique {id: $technique_id})
  ON CREATE SET te.name = $technique_name
MERGE (te)-[:BELONGS_TO]->(t)
MERGE (a:AttackAction {uuid: $uuid})
SET a.name = $name,
    a.description = $description,
    a.source = $source,
    a.command_template = $command_template,
    a.executor = $executor,
    a.privilege = $privilege,
    a.required_services = $required_services,
    a.required_credentials = $required_credentials,
    a.required_access = $required_access,
    a.additional = $additional_pre,
    a.effect_grants_access = $grants_access,
    a.effect_creates_artifact = $creates_artifact,
    a.effect_lateral_target = $lateral_target,
    a.cost = $cost,
    a.rules_of_engagement_required = $roe,
    a.enrichment_quality = $enrichment_quality,
    a.provenance_tool = $prov_tool,
    a.provenance_report = $prov_report,
    a.provenance_confidence = $prov_confidence
MERGE (a)-[:IMPLEMENTS]->(te)
"""

MERGE_LEADS_TO = """
MERGE (a:Technique {id: $from_tid})
MERGE (b:Technique {id: $to_tid})
MERGE (a)-[:LEADS_TO]->(b)
"""

MERGE_REQUIRES = """
MERGE (a:Technique {id: $from_tid})
MERGE (b:Technique {id: $to_tid})
MERGE (a)-[:REQUIRES]->(b)
"""

COUNT_QUERY = """
MATCH (n)
RETURN labels(n)[0] AS type, count(*) AS n
ORDER BY n DESC
"""


# ─── Driver ─────────────────────────────────────────────────────────────────

def load_nodes(seed_path: Path | None, attackg_path: Path | None) -> list[dict]:
    nodes: list[dict] = []
    if seed_path:
        nodes.extend(json.loads(seed_path.read_text(encoding="utf-8")))
    if attackg_path:
        nodes.extend(json.loads(attackg_path.read_text(encoding="utf-8")))
    return nodes


def node_to_params(node: dict) -> dict:
    """Flatten a PDDL node into Cypher parameter map."""
    pre = node.get("preconditions", {})
    eff = node.get("effects", {})
    prov = node.get("provenance", {})
    return {
        "uuid": node["uuid"],
        "name": node["name"],
        "technique_id": node["mitre_technique"],
        "technique_name": node.get("description", "")[:200],
        "tactic_id": node["mitre_tactic"],
        "description": node.get("description", ""),
        "source": node.get("source", ""),
        "command_template": node.get("command_template") or "",
        "executor": pre.get("executor", "bash"),
        "privilege": pre.get("privilege", "user"),
        "required_services": pre.get("required_services", []),
        "required_credentials": pre.get("required_credentials", []),
        "required_access": pre.get("required_access", "local"),
        "additional_pre": pre.get("additional", []),
        "grants_access": eff.get("grants_access"),
        "creates_artifact": eff.get("creates_artifact"),
        "lateral_target": eff.get("lateral_target"),
        "cost": float(node.get("cost", 0.3)),
        "roe": bool(node.get("rules_of_engagement_required", False)),
        "enrichment_quality": node.get("enrichment_quality", "default"),
        "prov_tool": prov.get("tool", "manual"),
        "prov_report": prov.get("report", ""),
        "prov_confidence": float(prov.get("confidence", 0.0)),
    }


def chunked(items: list, size: int) -> Iterable[list]:
    for i in range(0, len(items), size):
        yield items[i:i + size]


def run_import(uri: str, user: str, password: str, nodes: list[dict],
               leads_to: list[tuple[str, str]], requires: list[tuple[str, str]],
               batch_size: int, dry_run: bool) -> None:

    if dry_run:
        print(f"[DRY RUN] Would write {len(nodes)} AttackAction nodes")
        print(f"[DRY RUN] Would write {len(leads_to)} LEADS_TO edges")
        print(f"[DRY RUN] Would write {len(requires)} REQUIRES edges")
        print(f"[DRY RUN] Sample node params:")
        if nodes:
            sample = node_to_params(nodes[0])
            print(json.dumps(sample, indent=2, default=str))
        return

    try:
        from neo4j import GraphDatabase, basic_auth
    except ImportError:
        print("Missing dependency: `pip install neo4j`", file=sys.stderr)
        sys.exit(2)

    driver = GraphDatabase.driver(uri, auth=basic_auth(user, password))
    try:
        with driver.session() as session:
            print(f"Connected to {uri}")

            # 1. Indexes
            for q in CREATE_INDEXES:
                session.run(q)

            # 2. Tactic nodes
            for tid, tname in TACTIC_NAMES.items():
                session.run(MERGE_TACTIC, id=tid, name=tname)

            # 3. AttackAction nodes (batched)
            total = 0
            for batch in chunked(nodes, batch_size):
                for node in batch:
                    params = node_to_params(node)
                    session.run(MERGE_ACTION, **params)
                total += len(batch)
                print(f"  imported {total}/{len(nodes)} nodes")

            # 4. LEADS_TO + REQUIRES edges
            for src, dst in leads_to:
                session.run(MERGE_LEADS_TO, from_tid=src, to_tid=dst)
            for src, dst in requires:
                session.run(MERGE_REQUIRES, from_tid=src, to_tid=dst)

            # 5. Verify
            print("\n=== Final counts ===")
            for record in session.run(COUNT_QUERY):
                print(f"  {record['type']}: {record['n']}")
    finally:
        driver.close()


# ─── CLI ─────────────────────────────────────────────────────────────────────

def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--seed", type=Path, help="Hand-written seed PDDL nodes JSON")
    ap.add_argument("--attackg", type=Path, help="AttacKG-derived nodes JSON")
    ap.add_argument("--uri", default=os.environ.get("NEO4J_URI", "bolt://localhost:7687"),
                    help="Neo4j URI (env NEO4J_URI; default bolt://localhost:7687)")
    ap.add_argument("--user", default=os.environ.get("NEO4J_USER", "neo4j"),
                    help="Neo4j user (env NEO4J_USER; default neo4j)")
    ap.add_argument("--password", default=os.environ.get("NEO4J_PASSWORD", ""),
                    help="Neo4j password (env NEO4J_PASSWORD)")
    ap.add_argument("--batch-size", type=int, default=500)
    ap.add_argument("--dry-run", action="store_true",
                    help="Show what would be imported, don't write")
    args = ap.parse_args()

    if not args.seed and not args.attackg:
        ap.error("Must provide at least one of --seed or --attackg")
    if not args.dry_run and not args.password:
        ap.error("--password (or NEO4J_PASSWORD env) required unless --dry-run")

    nodes = load_nodes(args.seed, args.attackg)
    print(f"Loaded {len(nodes)} nodes total")

    run_import(args.uri, args.user, args.password, nodes,
               DEFAULT_LEADS_TO_EDGES, DEFAULT_REQUIRES_EDGES,
               args.batch_size, args.dry_run)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
