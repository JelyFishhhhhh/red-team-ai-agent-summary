#!/usr/bin/env python3
import os
from neo4j import GraphDatabase, basic_auth

URI  = os.environ.get("NEO4J_URI",      "neo4j+s://b267f815.databases.neo4j.io")
USER = os.environ.get("NEO4J_USERNAME", "b267f815")
PASS = os.environ.get("NEO4J_PASSWORD", "")

EDGE = "MERGE (a:Technique {{id:'{s}'}}) MERGE (b:Technique {{id:'{d}'}}) MERGE (a)-[:LEADS_TO]->(b)"

PATCHES = [
    ("T1021.006", "T1562.001", "WinRM → disable defender"),
    ("T1059.001", "T1562.001", "PowerShell → disable defender"),
    ("T1562.001", "T1005",     "defense evasion → collect local"),
    ("T1562.001", "T1039",     "defense evasion → collect shares"),
    ("T1005",     "T1041",     "local data → exfil via C2"),
    ("T1039",     "T1041",     "share data → exfil via C2"),
    ("T1039",     "T1048.003", "share data → alt exfil"),
    ("T1098",     "T1070.001", "DA backdoor → clear logs"),
    ("T1003.006", "T1070.001", "DCSync → clear logs"),
    ("T1021.006", "T1548.002", "WinRM user → UAC bypass"),
    ("T1548.002", "T1562.001", "admin gained → disable defender"),
]

driver = GraphDatabase.driver(URI, auth=basic_auth(USER, PASS))
with driver.session() as s:
    for src, dst, desc in PATCHES:
        s.run(EDGE.format(s=src, d=dst))
        print(f"[OK] {src} → {dst}  ({desc})")
driver.close()
print("Done.")
