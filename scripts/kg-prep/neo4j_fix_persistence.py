#!/usr/bin/env python3
"""
neo4j_fix_persistence.py — LEADS_TO edges for Persistence / Execution depth.
MERGE on Technique {id:...} nodes (same schema as import_to_neo4j.py).
"""
import os
from neo4j import GraphDatabase, basic_auth

URI  = os.environ.get("NEO4J_URI",      "neo4j+s://b267f815.databases.neo4j.io")
USER = os.environ.get("NEO4J_USERNAME", "b267f815")
PASS = os.environ.get("NEO4J_PASSWORD", "")

EDGE = "MERGE (a:Technique {{id:'{s}'}}) MERGE (b:Technique {{id:'{d}'}}) MERGE (a)-[:LEADS_TO]->(b)"

PATCHES = [
    ("T1021.006", "T1543.003", "WinRM shell → create Windows service"),
    ("T1021.006", "T1059.003", "WinRM shell → cmd domain recon"),
    ("T1021.006", "T1047",     "WinRM shell → WMI process create"),
    ("T1059.001", "T1047",     "PowerShell → WMI exec"),
    ("T1547.001", "T1543.003", "registry persist → service persist (depth)"),
    ("T1543.003", "T1489",     "malicious service → service stop (impact)"),
    ("T1053.005", "T1543.003", "scheduled task → service (depth)"),
    ("T1021.006", "T1053.005", "WinRM shell → scheduled task"),
]

driver = GraphDatabase.driver(URI, auth=basic_auth(USER, PASS))
with driver.session() as s:
    for src, dst, desc in PATCHES:
        s.run(EDGE.format(s=src, d=dst))
        print(f"[OK] {src} → {dst}  ({desc})")
driver.close()
print("Done.")
