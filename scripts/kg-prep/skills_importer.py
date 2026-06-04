#!/usr/bin/env python3
"""
skills_importer.py
==================
Import cybersecurity skills from mukul975/Anthropic-Cybersecurity-Skills into
the KG node format used by red-team-ai-agent-summary.

Usage:
    python3 skills_importer.py \
        --skills-dir /path/to/Anthropic-Cybersecurity-Skills/skills/ \
        --tactics TA0003 TA0011 TA0040 \
        --output skills_nodes.json \
        --limit 30

Requirements:
    pip install pyyaml requests
"""

import argparse
import json
import os
import re
import sys
from pathlib import Path
from typing import Optional

try:
    import yaml
except ImportError:
    print("ERROR: pyyaml not installed. Run: pip install pyyaml", file=sys.stderr)
    sys.exit(1)

# ---------------------------------------------------------------------------
# ATT&CK Tactic ID → tactic slug and reverse map
# ---------------------------------------------------------------------------

TACTIC_MAP: dict[str, str] = {
    "initial-access":       "TA0001",
    "execution":            "TA0002",
    "persistence":          "TA0003",
    "privilege-escalation": "TA0004",
    "defense-evasion":      "TA0005",
    "credential-access":    "TA0006",
    "discovery":            "TA0007",
    "lateral-movement":     "TA0008",
    "collection":           "TA0009",
    "command-and-control":  "TA0011",
    "exfiltration":         "TA0010",
    "impact":               "TA0040",
    "resource-development": "TA0042",
    "reconnaissance":       "TA0043",
}

# Reverse: TA-ID → slug
TACTIC_ID_TO_SLUG: dict[str, str] = {v: k for k, v in TACTIC_MAP.items()}

# Map each T-ID prefix to the *primary* tactic it belongs to.
# Built from the ATT&CK Enterprise matrix (v14). Only the first two
# digits of the sub-technique matter (e.g. T1053.005 → T1053).
TECHNIQUE_TO_TACTIC: dict[str, str] = {
    # Reconnaissance  TA0043
    "T1595": "TA0043", "T1592": "TA0043", "T1589": "TA0043", "T1590": "TA0043",
    "T1591": "TA0043", "T1598": "TA0043", "T1596": "TA0043", "T1593": "TA0043",
    "T1597": "TA0043", "T1594": "TA0043",
    # Resource Development  TA0042
    "T1583": "TA0042", "T1586": "TA0042", "T1584": "TA0042", "T1587": "TA0042",
    "T1585": "TA0042", "T1588": "TA0042", "T1608": "TA0042",
    # Initial Access  TA0001
    "T1189": "TA0001", "T1190": "TA0001", "T1133": "TA0001", "T1200": "TA0001",
    "T1566": "TA0001", "T1091": "TA0001", "T1195": "TA0001", "T1199": "TA0001",
    "T1078": "TA0001",
    # Execution  TA0002
    "T1059": "TA0002", "T1203": "TA0002", "T1559": "TA0002", "T1106": "TA0002",
    "T1053": "TA0002", "T1129": "TA0002", "T1072": "TA0002", "T1569": "TA0002",
    "T1204": "TA0002", "T1047": "TA0002",
    # Persistence  TA0003
    "T1098": "TA0003", "T1197": "TA0003", "T1547": "TA0003", "T1037": "TA0003",
    "T1176": "TA0003", "T1554": "TA0003", "T1136": "TA0003", "T1543": "TA0003",
    "T1546": "TA0003", "T1133": "TA0003", "T1574": "TA0003", "T1525": "TA0003",
    "T1556": "TA0003", "T1137": "TA0003", "T1542": "TA0003", "T1053": "TA0003",
    "T1505": "TA0003", "T1205": "TA0003", "T1078": "TA0003",
    # Privilege Escalation  TA0004
    "T1548": "TA0004", "T1134": "TA0004", "T1484": "TA0004", "T1611": "TA0004",
    "T1068": "TA0004", "T1055": "TA0004",
    # Defense Evasion  TA0005
    "T1140": "TA0005", "T1006": "TA0005", "T1484": "TA0005", "T1480": "TA0005",
    "T1211": "TA0005", "T1222": "TA0005", "T1564": "TA0005", "T1574": "TA0005",
    "T1562": "TA0005", "T1070": "TA0005", "T1202": "TA0005", "T1036": "TA0005",
    "T1112": "TA0005", "T1556": "TA0005", "T1578": "TA0005", "T1601": "TA0005",
    "T1027": "TA0005", "T1647": "TA0005", "T1055": "TA0005", "T1207": "TA0005",
    "T1553": "TA0005", "T1218": "TA0005", "T1216": "TA0005", "T1220": "TA0005",
    "T1497": "TA0005", "T1600": "TA0005", "T1220": "TA0005",
    # Credential Access  TA0006
    "T1110": "TA0006", "T1555": "TA0006", "T1212": "TA0006", "T1187": "TA0006",
    "T1606": "TA0006", "T1056": "TA0006", "T1556": "TA0006", "T1040": "TA0006",
    "T1003": "TA0006", "T1528": "TA0006", "T1558": "TA0006", "T1539": "TA0006",
    "T1111": "TA0006", "T1621": "TA0006",
    # Discovery  TA0007
    "T1087": "TA0007", "T1010": "TA0007", "T1217": "TA0007", "T1580": "TA0007",
    "T1538": "TA0007", "T1526": "TA0007", "T1619": "TA0007", "T1613": "TA0007",
    "T1482": "TA0007", "T1083": "TA0007", "T1615": "TA0007", "T1046": "TA0007",
    "T1135": "TA0007", "T1040": "TA0007", "T1201": "TA0007", "T1120": "TA0007",
    "T1069": "TA0007", "T1057": "TA0007", "T1012": "TA0007", "T1018": "TA0007",
    "T1518": "TA0007", "T1082": "TA0007", "T1016": "TA0007", "T1049": "TA0007",
    "T1033": "TA0007", "T1007": "TA0007", "T1124": "TA0007", "T1497": "TA0007",
    # Lateral Movement  TA0008
    "T1210": "TA0008", "T1534": "TA0008", "T1570": "TA0008", "T1563": "TA0008",
    "T1021": "TA0008", "T1091": "TA0008", "T1072": "TA0008", "T1080": "TA0008",
    "T1550": "TA0008",
    # Collection  TA0009
    "T1560": "TA0009", "T1123": "TA0009", "T1119": "TA0009", "T1185": "TA0009",
    "T1115": "TA0009", "T1530": "TA0009", "T1602": "TA0009", "T1213": "TA0009",
    "T1005": "TA0009", "T1039": "TA0009", "T1025": "TA0009", "T1074": "TA0009",
    "T1114": "TA0009", "T1056": "TA0009", "T1113": "TA0009", "T1125": "TA0009",
    # Command and Control  TA0011
    "T1071": "TA0011", "T1092": "TA0011", "T1132": "TA0011", "T1001": "TA0011",
    "T1568": "TA0011", "T1573": "TA0011", "T1008": "TA0011", "T1105": "TA0011",
    "T1104": "TA0011", "T1090": "TA0011", "T1219": "TA0011", "T1205": "TA0011",
    "T1572": "TA0011",
    # Exfiltration  TA0010
    "T1020": "TA0010", "T1030": "TA0010", "T1048": "TA0010", "T1041": "TA0010",
    "T1011": "TA0010", "T1052": "TA0010", "T1567": "TA0010", "T1029": "TA0010",
    "T1537": "TA0010",
    # Impact  TA0040
    "T1531": "TA0040", "T1485": "TA0040", "T1486": "TA0040", "T1565": "TA0040",
    "T1491": "TA0040", "T1561": "TA0040", "T1499": "TA0040", "T1495": "TA0040",
    "T1490": "TA0040", "T1498": "TA0040", "T1496": "TA0040", "T1489": "TA0040",
    "T1529": "TA0040",
}

# Subdomain → tactic slug hints
SUBDOMAIN_TACTIC_HINTS: dict[str, str] = {
    "red-teaming":         "TA0001",   # generic fallback for red-team skills
    "threat-hunting":      "TA0007",
    "forensics":           "TA0007",
    "dfir":                "TA0007",
    "identity-security":   "TA0006",
    "malware-analysis":    "TA0005",
    "ransomware-defense":  "TA0040",
    "network-security":    "TA0011",
    "cloud-security":      "TA0007",
    "osint":               "TA0043",
}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_IP_RE = re.compile(
    r"\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b"
)
_DOMAIN_RE = re.compile(r"\b[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?\b")
_USER_RE = re.compile(r"\b(?:jsmith|administrator|admin|user|testuser|mahipal)\b", re.I)
_PASS_RE = re.compile(r"(?:Password\d+!?|Summer\d{4}!?|P@ss\w+|Passw0rd\w*)", re.I)
_HASH_RE = re.compile(r"\b[a-fA-F0-9]{32,}\b")


def _redact_command(cmd: str) -> str:
    """Replace hardcoded IPs, credentials, hashes with {var} placeholders."""
    cmd = _IP_RE.sub("{target_ip}", cmd)
    cmd = _PASS_RE.sub("{password}", cmd)
    cmd = _HASH_RE.sub("{hash}", cmd)
    cmd = _USER_RE.sub("{username}", cmd)
    # corp.local style domains
    cmd = re.sub(r"\b\w+\.local\b", "{domain}", cmd)
    return cmd


def _slug_to_snake(slug: str) -> str:
    """Convert kebab-case skill name to snake_case."""
    return slug.replace("-", "_")


def _parse_frontmatter(text: str) -> tuple[dict, str]:
    """
    Extract YAML frontmatter from a Markdown file.
    Returns (metadata_dict, body_text).
    """
    if not text.startswith("---"):
        return {}, text
    parts = text.split("---", 2)
    if len(parts) < 3:
        return {}, text
    try:
        meta = yaml.safe_load(parts[1]) or {}
    except yaml.YAMLError:
        meta = {}
    return meta, parts[2]


def _extract_commands_from_body(body: str) -> list[str]:
    """Extract shell commands from fenced code blocks in markdown body."""
    commands: list[str] = []
    # Match ```bash / ```sh / ``` blocks
    pattern = re.compile(r"```(?:bash|sh|powershell|cmd|shell)?\s*\n(.*?)```", re.DOTALL | re.I)
    for m in pattern.finditer(body):
        block = m.group(1).strip()
        for line in block.splitlines():
            line = line.strip()
            if line and not line.startswith("#"):
                commands.append(line)
    return commands


def _infer_tactic(meta: dict, skill_name: str) -> Optional[str]:
    """
    Derive the primary tactic TA-ID from skill metadata.
    Priority: mitre_attack technique map → tags → subdomain → name keywords.
    """
    techniques: list[str] = meta.get("mitre_attack", []) or []

    # Walk techniques; resolve sub-technique to base (T1547.001 → T1547)
    for t in techniques:
        base = t.split(".")[0]
        tactic = TECHNIQUE_TO_TACTIC.get(base)
        if tactic:
            return tactic

    # Tags
    tags: list[str] = meta.get("tags", []) or []
    for tag in tags:
        tag_norm = tag.lower().replace("_", "-")
        for slug, ta_id in TACTIC_MAP.items():
            if tag_norm == slug or tag_norm.startswith(slug.split("-")[0]):
                return ta_id

    # Subdomain
    subdomain = (meta.get("subdomain") or "").lower()
    for key, ta_id in SUBDOMAIN_TACTIC_HINTS.items():
        if key in subdomain:
            return ta_id

    # Name keywords
    name_lower = skill_name.lower()
    keyword_hints = {
        "persist": "TA0003",
        "c2": "TA0011",
        "command-and-control": "TA0011",
        "beacon": "TA0011",
        "lateral": "TA0008",
        "pass-the": "TA0008",
        "kerberoast": "TA0006",
        "ransomware": "TA0040",
        "shadow-copy": "TA0040",
        "wiper": "TA0040",
        "impact": "TA0040",
        "exfil": "TA0010",
        "recon": "TA0043",
        "discovery": "TA0007",
        "privilege": "TA0004",
        "evasion": "TA0005",
        "credential": "TA0006",
        "inject": "TA0004",
        "initial-access": "TA0001",
        "phish": "TA0001",
    }
    for kw, ta_id in keyword_hints.items():
        if kw in name_lower:
            return ta_id

    return None


def _infer_executor(commands: list[str], meta: dict) -> str:
    tags = [t.lower() for t in (meta.get("tags") or [])]
    if "powershell" in tags:
        return "powershell"
    for cmd in commands:
        if cmd.strip().startswith("powershell") or "Invoke-" in cmd or "Get-" in cmd:
            return "powershell"
        if cmd.strip().startswith("cmd.exe") or "reg.exe" in cmd:
            return "cmd"
    return "bash"


def _infer_privilege(meta: dict, commands: list[str]) -> str:
    tags = [t.lower() for t in (meta.get("tags") or [])]
    if any(t in tags for t in ["domain-admin", "domain_admin", "enterprise-admin"]):
        return "domain_admin"
    if any(t in tags for t in ["admin", "administrator", "root", "elevated"]):
        return "admin"
    for cmd in commands:
        low = cmd.lower()
        if any(k in low for k in ["sudo", "runas /user:administrator", "privilege::debug", "sekurlsa"]):
            return "admin"
    return "user"


def _infer_required_access(meta: dict, commands: list[str]) -> str:
    tags = [t.lower() for t in (meta.get("tags") or [])]
    if any(t in tags for t in ["network", "lateral-movement", "remote"]):
        return "network"
    for cmd in commands:
        low = cmd.lower()
        if any(k in low for k in ["dc-ip", "smb", "wmi", "rdp", "psexec", "ssh", "ldap", "ldaps"]):
            return "network"
    return "local"


def _cost_from_privilege(priv: str) -> float:
    return {"none": 0.1, "user": 0.2, "admin": 0.3, "domain_admin": 0.5}.get(priv, 0.2)


def _effects_from_tactic(tactic: str) -> dict:
    tactic_effects = {
        "TA0003": {"grants_access": "persistence"},
        "TA0011": {"grants_access": "c2_channel"},
        "TA0040": {"grants_access": "impact"},
        "TA0008": {"grants_access": "lateral_movement"},
        "TA0006": {"grants_access": "credentials"},
        "TA0004": {"grants_access": "privilege_escalation"},
        "TA0001": {"grants_access": "initial_access"},
        "TA0007": {"grants_access": "information"},
        "TA0010": {"grants_access": "exfiltration"},
        "TA0005": {"grants_access": "defense_evasion"},
        "TA0002": {"grants_access": "code_execution"},
        "TA0009": {"grants_access": "collection"},
        "TA0042": {"grants_access": "infrastructure"},
        "TA0043": {"grants_access": "reconnaissance"},
    }
    return tactic_effects.get(tactic, {"grants_access": "unknown"})


# ---------------------------------------------------------------------------
# Core conversion
# ---------------------------------------------------------------------------

def skill_dir_to_node(skill_dir: Path, tactic_filter: Optional[set[str]] = None) -> Optional[dict]:
    """
    Convert a single skill directory into a KG node dict.
    Returns None if the skill should be skipped (wrong tactic or parse error).
    """
    skill_md = skill_dir / "SKILL.md"
    if not skill_md.exists():
        return None

    text = skill_md.read_text(encoding="utf-8", errors="replace")
    meta, body = _parse_frontmatter(text)

    if not meta:
        return None

    skill_name: str = meta.get("name") or skill_dir.name
    description: str = meta.get("description") or ""

    # Resolve tactic
    tactic_id = _infer_tactic(meta, skill_name)
    if tactic_id is None:
        return None  # Cannot map to any tactic → skip

    if tactic_filter and tactic_id not in tactic_filter:
        return None

    # Primary MITRE technique (first in list, prefer one that maps to our tactic)
    techniques: list[str] = meta.get("mitre_attack", []) or []
    primary_technique = ""
    for t in techniques:
        base = t.split(".")[0]
        if TECHNIQUE_TO_TACTIC.get(base) == tactic_id:
            primary_technique = t
            break
    if not primary_technique and techniques:
        primary_technique = techniques[0]

    # Extract commands
    commands = _extract_commands_from_body(body)
    has_command = bool(commands)

    if has_command:
        raw_cmd = commands[0]
        command_template = _redact_command(raw_cmd)
        enrichment_quality = "skills-imported"
    else:
        # Use first sentence of description as placeholder
        first_sentence = description.split(".")[0].strip() if description else skill_name
        command_template = f"# {first_sentence}"
        enrichment_quality = "description-only"

    # Determine executor, privilege, access
    executor = _infer_executor(commands, meta)
    privilege = _infer_privilege(meta, commands)
    required_access = _infer_required_access(meta, commands)

    # Build UUID
    technique_part = primary_technique.replace(".", "") if primary_technique else "T0000"
    # Counter based on a simple hash so same skill always gets same suffix
    counter = abs(hash(skill_name)) % 1000
    uuid = f"skills-{technique_part}-{counter:03d}"

    node = {
        "uuid": uuid,
        "name": _slug_to_snake(skill_name),
        "mitre_technique": primary_technique,
        "mitre_tactic": tactic_id,
        "description": description,
        "source": "mukul975/Anthropic-Cybersecurity-Skills",
        "command_template": command_template,
        "preconditions": {
            "executor": executor,
            "privilege": privilege,
            "required_services": [],
            "required_files": [],
            "required_credentials": [],
            "required_access": required_access,
            "additional": [],
        },
        "effects": _effects_from_tactic(tactic_id),
        "cost": _cost_from_privilege(privilege),
        "rules_of_engagement_required": False,
        "enrichment_quality": enrichment_quality,
        "provenance": {
            "tool": "skills-importer",
            "report": "mukul975-skills-v1",
            "confidence": 0.8,
        },
    }
    return node


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Import Anthropic-Cybersecurity-Skills into KG node format."
    )
    p.add_argument(
        "--skills-dir",
        required=True,
        help="Path to the 'skills/' directory inside the cloned repo.",
    )
    p.add_argument(
        "--tactics",
        nargs="+",
        default=None,
        help="Tactic IDs to include (e.g. TA0003 TA0011 TA0040). Omit for all.",
    )
    p.add_argument(
        "--output",
        default="skills_nodes.json",
        help="Output JSON file path.",
    )
    p.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Max number of nodes to output (0 = unlimited).",
    )
    p.add_argument(
        "--pretty",
        action="store_true",
        default=True,
        help="Pretty-print output JSON (default: True).",
    )
    return p.parse_args()


def main() -> None:
    args = parse_args()

    skills_dir = Path(args.skills_dir)
    if not skills_dir.is_dir():
        print(f"ERROR: skills-dir does not exist: {skills_dir}", file=sys.stderr)
        sys.exit(1)

    tactic_filter: Optional[set[str]] = set(args.tactics) if args.tactics else None

    nodes: list[dict] = []
    skipped = 0
    errors = 0

    # Each subdirectory of skills_dir is one skill
    skill_dirs = sorted(p for p in skills_dir.iterdir() if p.is_dir())
    total = len(skill_dirs)

    print(f"Scanning {total} skill directories ...", file=sys.stderr)
    if tactic_filter:
        slugs = [TACTIC_ID_TO_SLUG.get(t, t) for t in tactic_filter]
        print(f"Filtering to tactics: {', '.join(f'{t} ({s})' for t, s in zip(tactic_filter, slugs))}", file=sys.stderr)

    for skill_dir in skill_dirs:
        if args.limit and len(nodes) >= args.limit:
            break
        try:
            node = skill_dir_to_node(skill_dir, tactic_filter)
            if node is None:
                skipped += 1
            else:
                nodes.append(node)
        except Exception as exc:
            errors += 1
            print(f"  WARN: error processing {skill_dir.name}: {exc}", file=sys.stderr)

    print(f"Done. Converted: {len(nodes)}  Skipped: {skipped}  Errors: {errors}", file=sys.stderr)

    indent = 2 if args.pretty else None
    output_text = json.dumps(nodes, indent=indent, ensure_ascii=False)

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(output_text, encoding="utf-8")
    print(f"Written to: {out_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
