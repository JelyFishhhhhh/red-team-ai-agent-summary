#!/usr/bin/env python3
"""
neo4j_fix_impact_c2.py — LEADS_TO edges for Impact / C2 depth.
MERGE on Technique {id:...} nodes (same schema as import_to_neo4j.py).
"""
import os
from neo4j import GraphDatabase, basic_auth

URI  = os.environ.get("NEO4J_URI",      "neo4j+s://b267f815.databases.neo4j.io")
USER = os.environ.get("NEO4J_USERNAME", "b267f815")
PASS = os.environ.get("NEO4J_PASSWORD", "")

EDGE = "MERGE (a:Technique {{id:'{s}'}}) MERGE (b:Technique {{id:'{d}'}}) MERGE (a)-[:LEADS_TO]->(b)"

PATCHES = [
    ("T1105",     "T1572",     "certutil drops tool → chisel tunnel"),
    ("T1572",     "T1071.001", "tunnel up → HTTPS C2 beacon"),
    ("T1021.006", "T1105",     "WinRM shell → certutil tool transfer"),
    ("T1059.001", "T1105",     "PowerShell → certutil tool transfer"),
    ("T1098",     "T1489",     "DA backdoor → service stop"),
    ("T1003.006", "T1485",     "DCSync creds → shadow copy destruction"),
    ("T1543.003", "T1529",     "malicious service → forced reboot"),
]

driver = GraphDatabase.driver(URI, auth=basic_auth(USER, PASS))
with driver.session() as s:
    for src, dst, desc in PATCHES:
        s.run(EDGE.format(s=src, d=dst))
        print(f"[OK] {src} → {dst}  ({desc})")
    # Penalise legacy Linux service_stop so agent picks service_stop_windows
    s.run("MATCH (a:AttackAction {name:'service_stop'}) SET a.cost = 1.0")
    print("[OK] service_stop cost → 1.0 (Linux node deprioritised)")
driver.close()
print("Done.")
