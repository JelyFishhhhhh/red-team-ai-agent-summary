#!/usr/bin/env python3
"""
AttacKG → PDDL AttackAction converter.

Reads AttacKG outputs (techniques JSON or per-report GML files from
github.com/li-zhenyuan/Knowledge-enhanced-Attack-Graph) and emits PDDL-style
AttackAction nodes ready for APT-GPT KG import.

Each emitted node carries:
  - core identity (uuid, T-ID, name, tactic, source)
  - PDDL precondition / effect (via loevenich_rules.enrich)
  - provenance (which AttacKG report it came from, confidence)
  - command_template if AttacKG procedure example provides one

Usage:
  python attackg_to_pddl.py \\
      --input  /path/to/AttacKG/Results/output_techniques.json \\
      --output ./out/pddl_nodes.json \\
      [--limit 100]              # for sample-quality review
      [--min-confidence 0.7]     # filter AttacKG quality

Or with per-report GML files:
  python attackg_to_pddl.py \\
      --gml-dir /path/to/AttacKG/Results/ \\
      --output ./out/pddl_nodes.json
"""

from __future__ import annotations
import argparse
import json
import os
import re
import sys
from pathlib import Path
from typing import Iterable

# Local import — works when run as `python attackg_to_pddl.py`
sys.path.insert(0, str(Path(__file__).parent))
from loevenich_rules import enrich, to_dict, parent_id  # noqa: E402


# ─── ATT&CK Technique ID → Tactic ID (subset; expand as needed) ──────────────
# Covers the techniques most likely to appear in AttacKG's 28k corpus.

TECHNIQUE_TO_TACTIC: dict[str, str] = {
    # Reconnaissance
    "T1595": "TA0043", "T1590": "TA0043", "T1589": "TA0043", "T1592": "TA0043",
    # Resource Development
    "T1583": "TA0042", "T1584": "TA0042", "T1585": "TA0042", "T1587": "TA0042",
    "T1588": "TA0042", "T1608": "TA0042",
    # Initial Access
    "T1189": "TA0001", "T1190": "TA0001", "T1133": "TA0001", "T1566": "TA0001",
    "T1091": "TA0001", "T1195": "TA0001", "T1199": "TA0001", "T1078": "TA0001",
    # Execution
    "T1059": "TA0002", "T1106": "TA0002", "T1053": "TA0002", "T1129": "TA0002",
    "T1569": "TA0002", "T1204": "TA0002", "T1047": "TA0002",
    # Persistence
    "T1098": "TA0003", "T1197": "TA0003", "T1547": "TA0003", "T1037": "TA0003",
    "T1176": "TA0003", "T1554": "TA0003", "T1136": "TA0003", "T1543": "TA0003",
    "T1546": "TA0003", "T1574": "TA0003", "T1525": "TA0003", "T1556": "TA0003",
    "T1505": "TA0003", "T1542": "TA0003",
    # Privilege Escalation
    "T1548": "TA0004", "T1134": "TA0004", "T1484": "TA0004", "T1068": "TA0004",
    "T1055": "TA0004", "T1611": "TA0004",
    # Defense Evasion
    "T1140": "TA0005", "T1006": "TA0005", "T1480": "TA0005", "T1211": "TA0005",
    "T1222": "TA0005", "T1564": "TA0005", "T1562": "TA0005", "T1070": "TA0005",
    "T1202": "TA0005", "T1036": "TA0005", "T1578": "TA0005", "T1112": "TA0005",
    "T1601": "TA0005", "T1027": "TA0005", "T1207": "TA0005", "T1014": "TA0005",
    "T1218": "TA0005", "T1216": "TA0005", "T1553": "TA0005", "T1221": "TA0005",
    "T1170": "TA0005",  # ← AttacKG top-6 list
    # Credential Access
    "T1110": "TA0006", "T1555": "TA0006", "T1212": "TA0006", "T1187": "TA0006",
    "T1606": "TA0006", "T1056": "TA0006", "T1557": "TA0006", "T1111": "TA0006",
    "T1621": "TA0006", "T1040": "TA0006", "T1003": "TA0006", "T1528": "TA0006",
    "T1649": "TA0006", "T1558": "TA0006", "T1539": "TA0006", "T1552": "TA0006",
    # Discovery
    "T1087": "TA0007", "T1010": "TA0007", "T1217": "TA0007", "T1580": "TA0007",
    "T1538": "TA0007", "T1526": "TA0007", "T1482": "TA0007", "T1083": "TA0007",
    "T1046": "TA0007", "T1135": "TA0007", "T1201": "TA0007", "T1120": "TA0007",
    "T1069": "TA0007", "T1057": "TA0007", "T1012": "TA0007", "T1018": "TA0007",
    "T1518": "TA0007", "T1082": "TA0007", "T1614": "TA0007", "T1016": "TA0007",
    "T1049": "TA0007", "T1033": "TA0007", "T1007": "TA0007",
    # Lateral Movement
    "T1210": "TA0008", "T1534": "TA0008", "T1570": "TA0008", "T1563": "TA0008",
    "T1021": "TA0008", "T1080": "TA0008", "T1550": "TA0008",
    # Collection
    "T1560": "TA0009", "T1123": "TA0009", "T1119": "TA0009", "T1185": "TA0009",
    "T1115": "TA0009", "T1530": "TA0009", "T1602": "TA0009", "T1213": "TA0009",
    "T1005": "TA0009", "T1039": "TA0009", "T1025": "TA0009", "T1074": "TA0009",
    "T1114": "TA0009", "T1113": "TA0009", "T1125": "TA0009",
    # Exfiltration
    "T1020": "TA0010", "T1030": "TA0010", "T1048": "TA0010", "T1041": "TA0010",
    "T1011": "TA0010", "T1052": "TA0010", "T1567": "TA0010", "T1029": "TA0010",
    "T1537": "TA0010",
    # Command and Control
    "T1071": "TA0011", "T1092": "TA0011", "T1132": "TA0011", "T1001": "TA0011",
    "T1568": "TA0011", "T1573": "TA0011", "T1008": "TA0011", "T1105": "TA0011",
    "T1104": "TA0011", "T1095": "TA0011", "T1571": "TA0011", "T1572": "TA0011",
    "T1090": "TA0011", "T1219": "TA0011", "T1102": "TA0011",
    # Impact
    "T1531": "TA0040", "T1485": "TA0040", "T1486": "TA0040", "T1565": "TA0040",
    "T1491": "TA0040", "T1561": "TA0040", "T1499": "TA0040", "T1495": "TA0040",
    "T1490": "TA0040", "T1498": "TA0040", "T1496": "TA0040", "T1489": "TA0040",
    "T1529": "TA0040",
}


def resolve_tactic(technique_id: str) -> str | None:
    """Map T-ID (or sub-T-ID) to its primary tactic."""
    p = parent_id(technique_id)
    return TECHNIQUE_TO_TACTIC.get(p)


# ─── AttacKG parsers ─────────────────────────────────────────────────────────

T_ID_REGEX = re.compile(r"T\d{4}(?:\.\d{3})?")


def parse_techniques_json(path: Path) -> Iterable[dict]:
    """
    AttacKG `output_techniques.json` schema (best-effort; their format is
    semi-structured). Expected fields per entry:
      - technique_id  (e.g. "T1547.001")
      - technique_name
      - report (filename)
      - confidence (0..1) — optional
      - procedure (free text)
      - entities (dict)
    Missing fields are tolerated.
    """
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # The actual AttacKG output may be a list or {report: [techniques]} map
    if isinstance(data, list):
        for item in data:
            yield item
    elif isinstance(data, dict):
        for report_name, techniques in data.items():
            if isinstance(techniques, list):
                for t in techniques:
                    if isinstance(t, dict):
                        t.setdefault("report", report_name)
                        yield t


def parse_gml_dir(directory: Path) -> Iterable[dict]:
    """
    Extract T-IDs from AttacKG GML output files.

    GML files contain nodes with labels referencing ATT&CK techniques.
    We treat each unique (T-ID, report) pair as one technique instance.
    """
    seen: set[tuple[str, str]] = set()
    for gml_file in sorted(directory.glob("*.gml")):
        report = gml_file.stem
        try:
            text = gml_file.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        for match in T_ID_REGEX.finditer(text):
            tid = match.group(0)
            key = (tid, report)
            if key in seen:
                continue
            seen.add(key)
            yield {
                "technique_id": tid,
                "report": report,
                "source_format": "gml",
            }


# ─── Conversion to PDDL AttackAction node ────────────────────────────────────

def make_uuid(tid: str, report: str, idx: int) -> str:
    safe_report = re.sub(r"[^a-zA-Z0-9]+", "_", report)[:40].lower().strip("_")
    return f"aa-attackg-{tid.lower().replace('.', '_')}-{safe_report}-{idx:04d}"


def attackg_entry_to_node(entry: dict, idx: int) -> dict | None:
    """
    Convert one AttacKG entry into an APT-GPT PDDL AttackAction node.
    Returns None when the entry has no usable T-ID.
    """
    tid = entry.get("technique_id") or entry.get("technique") or ""
    if not T_ID_REGEX.fullmatch(tid):
        # try to extract from text
        m = T_ID_REGEX.search(str(entry))
        if not m:
            return None
        tid = m.group(0)

    tactic = resolve_tactic(tid)
    if tactic is None:
        # unknown technique — skip with note rather than guess
        return None

    enrichment = enrich(tid, tactic)
    report = entry.get("report", "unknown")
    confidence = float(entry.get("confidence", 0.0) or 0.0)

    node = {
        "uuid": make_uuid(tid, report, idx),
        "name": f"attackg_{tid.lower().replace('.', '_')}_{idx}",
        "mitre_technique": tid,
        "mitre_tactic": tactic,
        "description": entry.get("technique_name") or entry.get("procedure") or "",
        "source": f"AttacKG [{report}]",
        "command_template": entry.get("procedure", "").strip() or None,
        "provenance": {
            "tool": "AttacKG",
            "report": report,
            "confidence": confidence,
        },
    }
    node.update(to_dict(enrichment))
    return node


# ─── CLI ─────────────────────────────────────────────────────────────────────

def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    src = ap.add_mutually_exclusive_group(required=True)
    src.add_argument("--input", type=Path,
                     help="AttacKG techniques JSON file (Results/output_techniques.json)")
    src.add_argument("--gml-dir", type=Path,
                     help="Directory containing per-report .gml files")
    ap.add_argument("--output", type=Path, required=True,
                    help="Output JSON path (will be created)")
    ap.add_argument("--limit", type=int, default=0,
                    help="Stop after N nodes (0 = unlimited)")
    ap.add_argument("--min-confidence", type=float, default=0.0,
                    help="Skip AttacKG entries below this confidence")
    args = ap.parse_args()

    if args.input:
        source = parse_techniques_json(args.input)
    else:
        source = parse_gml_dir(args.gml_dir)

    out_nodes: list[dict] = []
    skipped_unknown_tid = 0
    skipped_low_confidence = 0

    for idx, entry in enumerate(source):
        confidence = float(entry.get("confidence", 0.0) or 0.0)
        if confidence < args.min_confidence and confidence > 0:
            skipped_low_confidence += 1
            continue
        node = attackg_entry_to_node(entry, idx)
        if node is None:
            skipped_unknown_tid += 1
            continue
        out_nodes.append(node)
        if args.limit and len(out_nodes) >= args.limit:
            break

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(out_nodes, indent=2, ensure_ascii=False),
                           encoding="utf-8")

    # quality summary
    by_quality = {"rule-based": 0, "default": 0}
    by_tactic: dict[str, int] = {}
    for n in out_nodes:
        by_quality[n["enrichment_quality"]] = by_quality.get(n["enrichment_quality"], 0) + 1
        by_tactic[n["mitre_tactic"]] = by_tactic.get(n["mitre_tactic"], 0) + 1

    print(f"Wrote {len(out_nodes)} nodes → {args.output}")
    print(f"  Skipped (unknown T-ID): {skipped_unknown_tid}")
    print(f"  Skipped (low confidence): {skipped_low_confidence}")
    print(f"  Enrichment quality: {by_quality}")
    print(f"  Per-tactic breakdown:")
    for tactic, count in sorted(by_tactic.items()):
        print(f"    {tactic}: {count}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
