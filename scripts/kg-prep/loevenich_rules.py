"""
Loevenich-style precondition/effect mapping rules.

Reference: Loevenich et al. (2025) "Automating CTI and Attack Chain Generation
using CSKG and LLMs" — IEEE ICMCIS, DOI: 10.1109/ICMCIS64378.2025.11047951

AttacKG provides 28k technique instances but lacks PDDL precondition/effect
annotations. This module supplies rule-based enrichment so each AttackAction
node carries the four Loevenich precondition categories:
  1. Executor (how to execute)
  2. Privilege (elevated required?)
  3. Files (external files needed?)
  4. Credentials (info needed?)
plus effect annotations (grants_access / creates_artifact / lateral_target).

Rules below are derived from ATT&CK technique documentation and Atomic Red
Team conventions. Coverage is best-effort: techniques without a matching rule
are emitted with permissive defaults (privilege=user, no specific requirements)
and flagged with `enrichment_quality: "default"` for downstream review.
"""

from __future__ import annotations
from dataclasses import dataclass, field, asdict
from typing import Optional


# ─── Precondition / effect schema (Loevenich Table-aligned) ──────────────────

@dataclass
class Precondition:
    executor: str = "bash"          # bash / cmd / powershell / python / browser
    privilege: str = "user"          # none / user / admin / root / domain_admin
    required_services: list[str] = field(default_factory=list)
    required_files: list[str] = field(default_factory=list)
    required_credentials: list[str] = field(default_factory=list)
    required_access: str = "local"   # local / network / physical
    additional: list[str] = field(default_factory=list)  # free-form predicates


@dataclass
class Effect:
    grants_access: Optional[str] = None     # shell / persistence / c2 / da / ...
    creates_artifact: Optional[str] = None  # webshell::path / file::path / ...
    lateral_target: Optional[str] = None    # web_server / dc / kube_master / ...
    additional: list[str] = field(default_factory=list)


@dataclass
class Enrichment:
    preconditions: Precondition
    effects: Effect
    cost: float
    rules_of_engagement_required: bool = False
    enrichment_quality: str = "rule-based"  # rule-based / default / hand-verified


# ─── Per-tactic default profile ──────────────────────────────────────────────
# When a specific technique rule is not found, fall back to its tactic's default
# (this is the "permissive but flagged" path).

TACTIC_DEFAULTS: dict[str, Enrichment] = {
    "TA0043": Enrichment(  # Reconnaissance
        Precondition(executor="bash", privilege="none", required_access="network"),
        Effect(grants_access="recon_data"),
        cost=0.1, enrichment_quality="default",
    ),
    "TA0042": Enrichment(  # Resource Development
        Precondition(executor="bash", privilege="user", required_access="local"),
        Effect(creates_artifact="staged_resource"),
        cost=0.4, enrichment_quality="default",
    ),
    "TA0001": Enrichment(  # Initial Access
        Precondition(executor="bash", privilege="none", required_access="network"),
        Effect(grants_access="initial_foothold"),
        cost=0.3, enrichment_quality="default",
    ),
    "TA0002": Enrichment(  # Execution
        Precondition(executor="bash", privilege="user", required_access="local"),
        Effect(grants_access="execution"),
        cost=0.2, enrichment_quality="default",
    ),
    "TA0003": Enrichment(  # Persistence
        Precondition(executor="bash", privilege="user", required_access="local"),
        Effect(grants_access="persistence", creates_artifact="persist_artifact"),
        cost=0.3, enrichment_quality="default",
    ),
    "TA0004": Enrichment(  # Privilege Escalation
        Precondition(executor="bash", privilege="user", required_access="local"),
        Effect(grants_access="admin"),
        cost=0.4, enrichment_quality="default",
    ),
    "TA0005": Enrichment(  # Defense Evasion (Stealth)
        Precondition(executor="bash", privilege="user", required_access="local"),
        Effect(grants_access="stealth"),
        cost=0.3, enrichment_quality="default",
    ),
    "TA0006": Enrichment(  # Credential Access
        Precondition(executor="bash", privilege="admin", required_access="local"),
        Effect(grants_access="credentials", creates_artifact="cred_dump"),
        cost=0.4, enrichment_quality="default",
    ),
    "TA0007": Enrichment(  # Discovery
        Precondition(executor="bash", privilege="user", required_access="local"),
        Effect(grants_access="discovery_data"),
        cost=0.1, enrichment_quality="default",
    ),
    "TA0008": Enrichment(  # Lateral Movement
        Precondition(executor="bash", privilege="user",
                     required_credentials=["domain_user"], required_access="network"),
        Effect(grants_access="remote_session", lateral_target="next_host"),
        cost=0.4, enrichment_quality="default",
    ),
    "TA0009": Enrichment(  # Collection
        Precondition(executor="bash", privilege="user", required_access="local"),
        Effect(creates_artifact="staged_data"),
        cost=0.2, enrichment_quality="default",
    ),
    "TA0011": Enrichment(  # Command and Control
        Precondition(executor="bash", privilege="user", required_access="network",
                     additional=["outbound_traffic_allowed"]),
        Effect(grants_access="c2_channel"),
        cost=0.3, enrichment_quality="default",
    ),
    "TA0010": Enrichment(  # Exfiltration
        Precondition(executor="bash", privilege="user", required_access="network"),
        Effect(creates_artifact="exfil_data"),
        cost=0.3, enrichment_quality="default",
    ),
    "TA0040": Enrichment(  # Impact
        Precondition(executor="bash", privilege="admin", required_access="local"),
        Effect(grants_access="impact"),
        cost=0.2, rules_of_engagement_required=True, enrichment_quality="default",
    ),
}


# ─── Specific technique-level rules ──────────────────────────────────────────
# Keys are parent T-IDs. Sub-techniques inherit unless explicitly overridden
# (use full "T1547.001" key for sub-technique override).

TECHNIQUE_RULES: dict[str, Enrichment] = {
    # ─── TA0003 Persistence ──────────────────────────────────────────────────
    "T1053": Enrichment(
        Precondition(executor="cmd", privilege="admin",
                     additional=["scheduled_task_service_running"]),
        Effect(grants_access="persistence", creates_artifact="scheduled_task"),
        cost=0.2, enrichment_quality="rule-based",
    ),
    "T1505.003": Enrichment(
        Precondition(executor="bash", privilege="none",
                     required_services=["http"],
                     additional=["upload_endpoint_writable"],
                     required_access="network"),
        Effect(grants_access="shell", creates_artifact="webshell",
               lateral_target="web_server"),
        cost=0.3, enrichment_quality="rule-based",
    ),
    "T1098": Enrichment(
        Precondition(executor="cmd", privilege="domain_admin",
                     required_credentials=["domain_admin_ticket"],
                     required_services=["ldap", "smb"],
                     required_access="network"),
        Effect(grants_access="domain_admin", creates_artifact="ad_account",
               lateral_target="domain"),
        cost=0.1, enrichment_quality="rule-based",
    ),
    "T1547.001": Enrichment(
        Precondition(executor="cmd", privilege="user"),
        Effect(grants_access="persistence", creates_artifact="registry_run_key"),
        cost=0.2, enrichment_quality="rule-based",
    ),
    "T1136.001": Enrichment(
        Precondition(executor="bash", privilege="admin"),
        Effect(grants_access="persistence", creates_artifact="local_account"),
        cost=0.2, enrichment_quality="rule-based",
    ),

    # ─── TA0011 Command and Control ──────────────────────────────────────────
    "T1572": Enrichment(
        Precondition(executor="bash", privilege="user",
                     additional=["outbound_http_allowed"],
                     required_access="network"),
        Effect(grants_access="c2_channel", creates_artifact="tunnel"),
        cost=0.3, enrichment_quality="rule-based",
    ),
    "T1132.001": Enrichment(
        Precondition(executor="powershell", privilege="user"),
        Effect(grants_access="stealth_c2"),
        cost=0.2, enrichment_quality="rule-based",
    ),
    "T1571": Enrichment(
        Precondition(executor="bash", privilege="user", required_access="network"),
        Effect(grants_access="c2_channel", creates_artifact="c2_session"),
        cost=0.3, enrichment_quality="rule-based",
    ),
    "T1105": Enrichment(
        Precondition(executor="bash", privilege="user", required_access="network"),
        Effect(grants_access="tool_available", creates_artifact="dropped_file"),
        cost=0.1, enrichment_quality="rule-based",
    ),
    "T1071": Enrichment(
        Precondition(executor="bash", privilege="user", required_access="network",
                     additional=["outbound_traffic_allowed"]),
        Effect(grants_access="c2_channel"),
        cost=0.3, enrichment_quality="rule-based",
    ),
    "T1090": Enrichment(
        Precondition(executor="bash", privilege="user", required_access="network"),
        Effect(grants_access="proxy_channel"),
        cost=0.3, enrichment_quality="rule-based",
    ),

    # ─── TA0040 Impact (RoE-required) ────────────────────────────────────────
    "T1531": Enrichment(
        Precondition(executor="cmd", privilege="admin"),
        Effect(grants_access="dos_user", creates_artifact="disabled_account"),
        cost=0.1, rules_of_engagement_required=True, enrichment_quality="rule-based",
    ),
    "T1489": Enrichment(
        Precondition(executor="bash", privilege="admin"),
        Effect(grants_access="dos_service"),
        cost=0.1, rules_of_engagement_required=True, enrichment_quality="rule-based",
    ),
    "T1486": Enrichment(
        Precondition(executor="bash", privilege="admin"),
        Effect(creates_artifact="encrypted_files"),
        cost=0.2, rules_of_engagement_required=True, enrichment_quality="rule-based",
    ),

    # ─── TA0006 Credential Access ────────────────────────────────────────────
    "T1003": Enrichment(
        Precondition(executor="cmd", privilege="admin",
                     required_services=["lsass"]),
        Effect(grants_access="credentials", creates_artifact="cred_dump"),
        cost=0.2, enrichment_quality="rule-based",
    ),
    "T1003.001": Enrichment(
        Precondition(executor="powershell", privilege="admin",
                     required_services=["lsass"]),
        Effect(grants_access="ntlm_hashes", creates_artifact="lsass_dump"),
        cost=0.2, enrichment_quality="rule-based",
    ),
    "T1558.003": Enrichment(
        Precondition(executor="bash", privilege="user",
                     required_services=["kerberos"], required_access="network"),
        Effect(grants_access="tgs_hash", creates_artifact="kerberos_ticket"),
        cost=0.2, enrichment_quality="rule-based",
    ),
    "T1110": Enrichment(
        Precondition(executor="bash", privilege="none", required_access="network"),
        Effect(grants_access="credentials"),
        cost=0.4, enrichment_quality="rule-based",
    ),
    "T1649": Enrichment(
        Precondition(executor="bash", privilege="user",
                     required_services=["adcs"], required_access="network"),
        Effect(grants_access="cert_auth", creates_artifact="forged_cert"),
        cost=0.3, enrichment_quality="rule-based",
    ),

    # ─── TA0008 Lateral Movement ─────────────────────────────────────────────
    "T1021": Enrichment(
        Precondition(executor="bash", privilege="user",
                     required_credentials=["valid_user"],
                     required_access="network"),
        Effect(grants_access="remote_session", lateral_target="next_host"),
        cost=0.3, enrichment_quality="rule-based",
    ),
    "T1021.002": Enrichment(
        Precondition(executor="cmd", privilege="user",
                     required_credentials=["smb_credentials"],
                     required_services=["smb"], required_access="network"),
        Effect(grants_access="remote_session", lateral_target="next_host"),
        cost=0.3, enrichment_quality="rule-based",
    ),
    "T1021.006": Enrichment(
        Precondition(executor="powershell", privilege="user",
                     required_credentials=["winrm_credentials"],
                     required_services=["winrm"], required_access="network"),
        Effect(grants_access="remote_session", lateral_target="next_host"),
        cost=0.3, enrichment_quality="rule-based",
    ),
    "T1550": Enrichment(
        Precondition(executor="bash", privilege="user",
                     required_credentials=["ntlm_hash"],
                     required_access="network"),
        Effect(grants_access="remote_session", lateral_target="next_host"),
        cost=0.3, enrichment_quality="rule-based",
    ),

    # ─── TA0001 Initial Access ───────────────────────────────────────────────
    "T1190": Enrichment(
        Precondition(executor="bash", privilege="none",
                     required_services=["http"], required_access="network"),
        Effect(grants_access="shell", lateral_target="web_server"),
        cost=0.3, enrichment_quality="rule-based",
    ),
    "T1078": Enrichment(
        Precondition(executor="bash", privilege="none",
                     required_credentials=["valid_credentials"],
                     required_access="network"),
        Effect(grants_access="valid_session"),
        cost=0.1, enrichment_quality="rule-based",
    ),
}


# ─── Public API ──────────────────────────────────────────────────────────────

def parent_id(tid: str) -> str:
    """T1547.001 → T1547. Pass through if already parent-level."""
    return tid.split(".")[0] if "." in tid else tid


def enrich(technique_id: str, tactic_id: str) -> Enrichment:
    """
    Return Loevenich-style precondition/effect for a given T-ID.

    Resolution order:
      1. Exact T-ID match (handles sub-technique overrides).
      2. Parent T-ID match.
      3. Tactic-level default (flagged enrichment_quality="default").
      4. Generic fallback if tactic unknown.
    """
    if technique_id in TECHNIQUE_RULES:
        return TECHNIQUE_RULES[technique_id]
    parent = parent_id(technique_id)
    if parent in TECHNIQUE_RULES:
        return TECHNIQUE_RULES[parent]
    if tactic_id in TACTIC_DEFAULTS:
        return TACTIC_DEFAULTS[tactic_id]
    return Enrichment(
        Precondition(), Effect(), cost=0.3, enrichment_quality="default",
    )


def to_dict(e: Enrichment) -> dict:
    """Serialise Enrichment to a plain dict for JSON / Cypher emission."""
    return {
        "preconditions": asdict(e.preconditions),
        "effects": {k: v for k, v in asdict(e.effects).items() if v not in (None, [])},
        "cost": e.cost,
        "rules_of_engagement_required": e.rules_of_engagement_required,
        "enrichment_quality": e.enrichment_quality,
    }


if __name__ == "__main__":
    # Quick self-test
    samples = [
        ("T1505.003", "TA0003"),
        ("T1572", "TA0011"),
        ("T1489", "TA0040"),
        ("T1547.005", "TA0003"),   # sub-technique not in rules → falls to parent T1547? No, T1547 not in rules → tactic default
        ("T9999", "TA0007"),       # unknown technique → tactic default
    ]
    import json
    for tid, tactic in samples:
        e = enrich(tid, tactic)
        print(f"{tid} ({tactic}): {json.dumps(to_dict(e), indent=2)}\n")
