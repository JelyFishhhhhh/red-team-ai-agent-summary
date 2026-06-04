#!/usr/bin/env python3
"""
One-shot Neo4j patch script — fixes false positives and command issues
found during GOAD v3 test runs (2026-06-04).

Run on GCP VM:
  NEO4J_URI=... NEO4J_USERNAME=... NEO4J_PASSWORD=... python3 neo4j_fixes.py
"""
import os
from neo4j import GraphDatabase, basic_auth

URI  = os.environ.get("NEO4J_URI",      "neo4j+s://b267f815.databases.neo4j.io")
USER = os.environ.get("NEO4J_USERNAME", "b267f815")
PASS = os.environ.get("NEO4J_PASSWORD", "")

driver = GraphDatabase.driver(URI, auth=basic_auth(USER, PASS))

PATCHES = [
    # ── Fix 1: T1558.003 Kerberoasting ───────────────────────────────────────
    # Remove the -outputfile + && wc chain; just stream to stdout.
    # Simpler command is more reliable and returncode 0 = real success.
    {
        "desc": "T1558.003 kerberoast_impacket: simplify command",
        "query": (
            "MATCH (a:AttackAction {name:'kerberoast_impacket'}) "
            "SET a.command_template = "
            "'GetUserSPNs.py -request -dc-ip {dc_ip} "
            "{domain}/{kerberoast_user}:{kerberoast_pass} 2>&1'"
        ),
    },

    # ── Fix 2: T1098 ACL abuse — suppress false-positive skill ───────────────
    # analyzing_active_directory_acl_abuse has empty stdout/stderr (local no-op).
    # Set cost=1.0 so the planner deprioritises it; it will only be picked
    # as last resort, and the empty-stdout guard prevents privilege upgrade.
    {
        "desc": "T1098 analyzing_active_directory_acl_abuse: cost → 1.0",
        "query": (
            "MATCH (a:AttackAction "
            "{name:'analyzing_active_directory_acl_abuse'}) "
            "SET a.cost = 1.0"
        ),
    },

    # ── Fix 3: T1003.006 DCSync — require domain_admin ───────────────────────
    # samwell.tarly (user) has no DS-Replication rights; DCSync only works
    # with DA creds.  Gate it behind domain_admin so KG privilege filter
    # only selects it after a real privilege upgrade.
    {
        "desc": "T1003.006 conducting_domain_persistence_with_dcsync: privilege → domain_admin",
        "query": (
            "MATCH (a:AttackAction "
            "{name:'conducting_domain_persistence_with_dcsync'}) "
            "SET a.privilege = 'domain_admin'"
        ),
    },

    # ── Fix 4: T1003.006 secretsdump_dcsync (seed node) — also domain_admin ──
    {
        "desc": "T1003.006 secretsdump_dcsync seed: privilege → domain_admin",
        "query": (
            "MATCH (a:AttackAction {name:'secretsdump_dcsync'}) "
            "SET a.privilege = 'domain_admin'"
        ),
    },
]

with driver.session() as s:
    for patch in PATCHES:
        s.run(patch["query"])
        print(f"[OK] {patch['desc']}")

    # Verify
    print("\n=== Verification ===")
    for name, field in [
        ("kerberoast_impacket", "command_template"),
        ("analyzing_active_directory_acl_abuse", "cost"),
        ("conducting_domain_persistence_with_dcsync", "privilege"),
        ("secretsdump_dcsync", "privilege"),
    ]:
        row = s.run(
            f"MATCH (a:AttackAction {{name:'{name}'}}) "
            f"RETURN a.{field} AS val"
        ).single()
        val = row["val"] if row else "(not found)"
        print(f"  {name}.{field} = {val!r}")

driver.close()
print("\nAll patches applied.")
