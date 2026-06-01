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


# ─── Composite cost formula (Cost-Function-Methodology.md §3) ────────────────
# cost(a) = w1·c_vuln + w2·c_cti + w3·c_priv + w4·c_net
#
# References per term:
#   c_vuln — CVSS (Hu 2020, Yousefi 2018, Chowdhary 2020)
#   c_cti  — Loevenich (2025) §IV-E
#   c_priv — Gangupantulu (2021) Crown Jewels terrain penalty
#   c_net  — Cody (2022) Exfiltration network dependency

DEFAULT_WEIGHTS = {"vuln": 0.4, "cti": 0.2, "priv": 0.2, "net": 0.2}

PRIV_COST = {
    "none": 0.0,
    "user": 0.1,
    "admin": 0.3,
    "root": 0.3,
    "domain_admin": 0.5,
}


def vuln_cost(cvss_exploitability: float | None) -> float | None:
    """CVSS-derived term. Returns None if no CVE binding (most ATT&CK persistence/
    C2/impact actions). When None, c_vuln drops out of the formula and w1 is
    redistributed uniformly across the other three terms.
    """
    if cvss_exploitability is None:
        return None
    return 1.0 - min(max(cvss_exploitability / 10.0, 0.0), 1.0)


def cti_cost(occurrences: int, max_occurrences: int = 1113) -> float:
    """Loevenich §IV-E: actions appearing in more CTI reports → lower cost.

    max_occurrences default is AttacKG's most-frequent technique (T1071 C&C =
    1113 reports). Override when working with a different corpus.
    """
    if occurrences <= 0:
        return 1.0
    return 1.0 - min(occurrences / max_occurrences, 1.0)


def priv_cost(precondition: Precondition) -> float:
    """Gangupantulu (2021) terrain: higher required privilege → higher cost
    (agent must first reach that privilege)."""
    return PRIV_COST.get(precondition.privilege, 0.2)


def net_cost(precondition: Precondition) -> float:
    """Cody (2022) network dependency: outbound channels add risk + setup."""
    if precondition.required_access == "local":
        return 0.0
    if precondition.additional:  # e.g. ["outbound_http_allowed"]
        return 0.2
    return 0.1


def composite_cost(precondition: Precondition,
                   cvss_exploitability: float | None = None,
                   cti_occurrences: int = 0,
                   weights: dict[str, float] | None = None) -> tuple[float, str]:
    """
    Combine the four terms per Cost-Function-Methodology.md §3.

    When cvss_exploitability is None (no CVE bound), w1 is redistributed
    uniformly across the remaining three terms — the documented fallback path
    for ATT&CK actions without CVE bindings.

    Returns (cost ∈ [0, 1], quality_tag) where quality_tag is one of:
      "composite-full"   — all four terms used (rare for ATT&CK actions)
      "composite-3term"  — fallback redistribution applied (typical)
    """
    w = weights or DEFAULT_WEIGHTS
    c_v = vuln_cost(cvss_exploitability)
    c_c = cti_cost(cti_occurrences)
    c_p = priv_cost(precondition)
    c_n = net_cost(precondition)

    if c_v is not None:
        cost = (w["vuln"] * c_v + w["cti"] * c_c
                + w["priv"] * c_p + w["net"] * c_n)
        return round(min(max(cost, 0.0), 1.0), 3), "composite-full"

    # Fallback: redistribute w1 uniformly across the remaining 3 weights.
    extra = w["vuln"] / 3.0
    cost = ((w["cti"] + extra) * c_c
            + (w["priv"] + extra) * c_p
            + (w["net"] + extra) * c_n)
    return round(min(max(cost, 0.0), 1.0), 3), "composite-3term"


# ─── Public API ──────────────────────────────────────────────────────────────

def parent_id(tid: str) -> str:
    """T1547.001 → T1547. Pass through if already parent-level."""
    return tid.split(".")[0] if "." in tid else tid


def enrich(technique_id: str,
           tactic_id: str,
           cti_occurrences: int = 0,
           cvss_exploitability: float | None = None,
           use_composite_cost: bool = False) -> Enrichment:
    """
    Return Loevenich-style precondition/effect for a given T-ID.

    Resolution order for precondition/effect:
      1. Exact T-ID match (handles sub-technique overrides).
      2. Parent T-ID match.
      3. Tactic-level default (flagged enrichment_quality="default").
      4. Generic fallback if tactic unknown.

    Cost handling:
      - Default: keep the hand-assigned cost on the matched Enrichment
        (preserves the hand-verified seed corpus exactly as authored).
      - use_composite_cost=True: replace the cost with composite_cost(...)
        per the 4-term formula. enrichment_quality is upgraded to
        "composite-full" / "composite-3term" depending on whether
        cvss_exploitability is provided.

    For Phase B4 W2 AttacKG bulk import, pass use_composite_cost=True
    so each node carries a principled cost grounded in CTI frequency
    + privilege + network terms.
    """
    if technique_id in TECHNIQUE_RULES:
        base = TECHNIQUE_RULES[technique_id]
    elif parent_id(technique_id) in TECHNIQUE_RULES:
        base = TECHNIQUE_RULES[parent_id(technique_id)]
    elif tactic_id in TACTIC_DEFAULTS:
        base = TACTIC_DEFAULTS[tactic_id]
    else:
        base = Enrichment(
            Precondition(), Effect(), cost=0.3, enrichment_quality="default",
        )

    if not use_composite_cost:
        return base

    new_cost, quality = composite_cost(
        base.preconditions,
        cvss_exploitability=cvss_exploitability,
        cti_occurrences=cti_occurrences,
    )
    return Enrichment(
        preconditions=base.preconditions,
        effects=base.effects,
        cost=new_cost,
        rules_of_engagement_required=base.rules_of_engagement_required,
        enrichment_quality=quality,
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
    # Quick self-test — compare hand-assigned cost vs composite-cost formula
    samples = [
        # (T-ID, Tactic, hypothetical CTI occurrences from AttacKG)
        ("T1505.003", "TA0003", 0),     # webshell — not in AttacKG top list
        ("T1572", "TA0011", 0),         # chisel tunnel
        ("T1489", "TA0040", 0),         # service stop
        ("T1547.005", "TA0003", 100),   # falls back to T1547 parent? No, T1547 unmapped → tactic default
        ("T1071", "TA0011", 1113),      # AttacKG top T-ID (C&C application layer)
        ("T1059", "TA0002", 1089),      # AttacKG #2
    ]
    print("=== Cost comparison: hand-assigned vs composite formula ===\n")
    for tid, tactic, occ in samples:
        hand = enrich(tid, tactic)
        comp = enrich(tid, tactic, cti_occurrences=occ, use_composite_cost=True)
        print(f"{tid} ({tactic}) cti_occ={occ}")
        print(f"  hand-assigned: cost={hand.cost} quality={hand.enrichment_quality}")
        print(f"  composite    : cost={comp.cost} quality={comp.enrichment_quality}")
        print()
