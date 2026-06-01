# KG-Prep Toolkit — Phase B4 W2 Pipeline

Three-stage Python pipeline that takes the 11 hand-written PDDL seed nodes
and AttacKG-derived technique instances and lands them in Neo4j as a
unified Attack Knowledge Graph.

```
              ┌─────────────────────────┐
              │ seed_nodes.json (11)    │ ← Hand-written, hand-verified
              └──────────┬──────────────┘
                         │
   AttacKG repo data     │
   (Results/*.json/gml)  │
            │            │
            ▼            │
  ┌──────────────────┐   │
  │ attackg_to_pddl  │   │
  │ + loevenich_rules│   │ ← Each AttacKG technique gets PDDL
  └──────────┬───────┘   │   precondition/effect via rule-based enrich
             │           │
             ▼           ▼
        ┌────────────────────┐
        │ import_to_neo4j.py │ ← Reads both JSON sources; writes Neo4j
        └─────────┬──────────┘
                  │
                  ▼
            Neo4j (remote)
```

## Files

| File | Purpose |
|---|---|
| `seed_nodes.json` | The 11 hand-written PDDL nodes (Persistence + C2 + Impact P0-Easy) |
| `loevenich_rules.py` | Precondition/effect enrichment rules following Loevenich et al. (2025) |
| `attackg_to_pddl.py` | Convert AttacKG JSON/GML → PDDL AttackAction nodes |
| `import_to_neo4j.py` | Batch import to Neo4j (env-configurable URI/auth) |

## Quick start (after Neo4j is up)

```bash
# 1. Install Neo4j Python driver
pip install neo4j

# 2. Point at your remote host
export NEO4J_URI=bolt://<remote-host>:7687
export NEO4J_USER=neo4j
export NEO4J_PASSWORD=<password>

# 3. Dry-run with just the 11 seed nodes (no network calls)
python import_to_neo4j.py --seed ./seed_nodes.json --dry-run

# 4. Real import of seed nodes
python import_to_neo4j.py --seed ./seed_nodes.json
```

## Adding AttacKG-derived nodes

```bash
# 1. Get AttacKG data (no code execution needed — just data files)
git clone --depth 1 https://github.com/li-zhenyuan/Knowledge-enhanced-Attack-Graph.git \
    /tmp/attackg

# 2. Convert their outputs to PDDL format
#    Option A: their pre-extracted techniques JSON
python attackg_to_pddl.py \
    --input  /tmp/attackg/Results/output_techniques.json \
    --output ./out/attackg_nodes.json \
    --limit  100        # sample first for quality review

#    Option B: per-report GML files
python attackg_to_pddl.py \
    --gml-dir /tmp/attackg/Results/ \
    --output  ./out/attackg_nodes.json

# 3. Import both seed + AttacKG nodes
python import_to_neo4j.py \
    --seed    ./seed_nodes.json \
    --attackg ./out/attackg_nodes.json
```

## What gets written to Neo4j

```
Nodes:
  (:Tactic     {id, name})                ← 14 ATT&CK tactics
  (:Technique  {id, name})                ← one per unique T-ID
  (:AttackAction {uuid, name, executor,
                  privilege, cost,
                  effect_grants_access,
                  ...PDDL fields...,
                  provenance_tool,
                  provenance_confidence})

Edges:
  (Technique)   -[:BELONGS_TO]-> (Tactic)
  (AttackAction)-[:IMPLEMENTS]->  (Technique)
  (Technique)   -[:LEADS_TO]->   (Technique)   ← 7 default edges
  (Technique)   -[:REQUIRES]->   (Technique)   ← 3 default edges
```

LEADS_TO and REQUIRES edges encode the 9-step Persistence + C2 + Impact
attack chain that drives the Tactic-loop planner.

## Verification queries

After import, run these in Neo4j Browser to confirm:

```cypher
// 1. Node counts per type
MATCH (n) RETURN labels(n)[0] AS type, count(*) ORDER BY count(*) DESC;

// 2. Find next actions from "Domain Admin" state (planner demo)
MATCH (current:Technique {id: "T1078"})-[:LEADS_TO]->(next:Technique)
OPTIONAL MATCH (next)<-[:IMPLEMENTS]-(action:AttackAction)
RETURN next.id, next.name, action.name, action.cost
ORDER BY action.cost ASC;

// 3. Full chain from web RCE to Impact
MATCH path = (start:Technique {id: "T1190"})-[:LEADS_TO*1..6]->(end:Technique {id: "T1489"})
RETURN [n IN nodes(path) | n.id] AS chain
LIMIT 1;

// 4. Sample a default-quality AttacKG node for manual review
MATCH (a:AttackAction {enrichment_quality: "default"})
RETURN a.uuid, a.mitre_technique, a.provenance_report
LIMIT 5;
```

## Quality flags

Each AttackAction carries `enrichment_quality`:

| Value | Meaning | Source |
|---|---|---|
| `hand-verified` | Hand-crafted by us, fully reviewed | `seed_nodes.json` |
| `rule-based` | Loevenich rule matched the T-ID specifically | technique-level rule hit |
| `default` | Fallback to tactic-level default (review before relying on) | tactic-level fallback |

Cypher to spot-check defaults:

```cypher
MATCH (a:AttackAction {enrichment_quality: "default"})
RETURN a.mitre_technique, count(*) ORDER BY count(*) DESC LIMIT 20;
```

Use the result to decide which T-IDs are worth adding to
`loevenich_rules.TECHNIQUE_RULES` for a quality bump.

## CLI reference

```
attackg_to_pddl.py
  --input PATH         AttacKG techniques JSON
  --gml-dir PATH       Directory of AttacKG GML files (alternative to --input)
  --output PATH        Output JSON path (required)
  --limit N            Stop after N nodes (0 = unlimited)
  --min-confidence X   Skip AttacKG entries below this confidence

import_to_neo4j.py
  --seed PATH          Hand-written seed JSON
  --attackg PATH       AttacKG-derived nodes JSON
  --uri URI            Override env NEO4J_URI
  --user NAME          Override env NEO4J_USER
  --password PW        Override env NEO4J_PASSWORD
  --batch-size N       Nodes per batch (default 500)
  --dry-run            Don't write; log what would happen
```

## References

- **AttacKG** — Li, Z. et al. (2022). *Constructing Technique Knowledge Graph from CTI Reports.* ESORICS 2022. arXiv:2111.07093
  - Repo (archived 2024-07-21): https://github.com/li-zhenyuan/Knowledge-enhanced-Attack-Graph
- **Loevenich PDDL CSKG** — Loevenich, J. F. et al. (2025). *Automating CTI and Attack Chain Generation using CSKG and LLMs.* IEEE ICMCIS. DOI: 10.1109/ICMCIS64378.2025.11047951
- See also: `wiki/APT-GPT/AttacKG-Fork-Evaluation.md`, `wiki/APT-GPT/Three-Papers-Synthesis.md`
