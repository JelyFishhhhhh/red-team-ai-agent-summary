# ATT&CK Technique Coverage Rubric — AI Red Team Agents

**Version:** 1.0  
**Date:** 2026-05-18  
**Scope:** Governs all `coverage` field values in `app/public/papers.json`

---

## 1. Motivation and Problem Statement

Claiming that an AI agent "covers" a MITRE ATT&CK technique requires a precise, reproducible criterion. Without one, coverage claims conflate three fundamentally different things:

1. A **tool** being present in the agent's environment
2. A **module** in the agent that nominally handles a category
3. An **autonomous decision** by the agent to apply a specific technique in response to environmental state

This rubric operationalizes coverage at the **technique level** (T-number), not the tactic level, and requires **evidence from primary sources** (papers, official documentation, or reproducible benchmarks).

---

## 2. Foundational Definitions

### 2.1 What is "coverage" in this context?

> **Coverage** of ATT&CK technique `Txxxx` by agent `A` means: agent `A` autonomously decides to apply the adversarial behavior described by `Txxxx` as part of a goal-directed attack sequence, and this behavior is evidenced in at least one documented scenario.

Three necessary conditions, all must hold:

| Condition | Meaning |
|---|---|
| **Autonomy** | The agent decides to use this technique — it is not scripted or directly instructed by a human in that instance |
| **Behavior match** | The agent's action matches the behavior described in ATT&CK's technique definition (not just a superficially similar action) |
| **Evidence** | The paper, official docs, or a reproducible benchmark demonstrates this occurring in at least one scenario |

### 2.2 What MITRE ATT&CK "technique" means

ATT&CK techniques describe **what** adversaries do at a behavior level — not which tool they use. From Strom et al. (2018):

> "Techniques represent 'how' an adversary achieves a tactical goal by performing an action."

This means:
- Running `nmap` is not itself a technique — it implements **T1595 Active Scanning**
- `nmap` run autonomously by an agent that decided to scan → T1595 is covered
- `nmap` run because a human typed "run nmap" → the human performed T1595, not the agent

### 2.3 Autonomy level definition

This rubric uses a simplified 3-level autonomy scale adapted from Endsley & Kaber (1999) and the SAE J3016 autonomy taxonomy:

| Level | Label | Definition |
|---|---|---|
| L3 | **Full autonomy** | Agent decides what to do, selects the technique, executes it, interprets results — no human involvement in this specific action |
| L2 | **Supervised autonomy** | Agent selects and executes the technique, but a human approves or confirms at one step (e.g., HITL checkpoint before exploit) |
| L1 | **Assisted execution** | Human decides the technique; agent only executes a specific tool call as directed |

**Coverage requires L2 or L3.** L1 is not agent coverage — it is human-directed tool use.

---

## 3. Coverage Labels

### 3.1 Label definitions

| Label | Code | Definition |
|---|---|---|
| `covered` | C | Agent at L2/L3 autonomy demonstrates this technique in ≥1 documented scenario with a successful or attempted outcome. |
| `partial` | P | Agent attempts the technique at L2/L3 but: (a) succeeds in <50% of documented attempts, OR (b) requires mid-technique human intervention beyond a HITL checkpoint, OR (c) only succeeds in easy/low-complexity scenarios while failing in harder ones. |
| `tool-dep` | T | An external tool autonomously implements the technique mechanics; the agent only invokes the tool and parses output. The agent performs no technique-specific reasoning — it could be swapped for a different tool without changing the agent's logic. |
| `not-covered` | N | At least one of: (a) paper/docs explicitly state this technique is out of scope, OR (b) agent achieves 0% in benchmark scenarios that require this technique, OR (c) technique is not mentioned in paper, docs, or case studies AND there is no architectural reason to infer coverage. |

### 3.2 The `tool-dep` vs `covered` boundary

This is the most common ambiguity. The test:

> **If the agent's technique-specific reasoning were removed — leaving only the tool call — would the agent still behave identically?**
>
> - **Yes** → `tool-dep`: the agent is a wrapper; the tool does the cognitive work
> - **No** → `covered` or `partial`: the agent contributes technique-specific decision logic

**Example:**
- Agent calls `nmap -sV target` and parses the XML output → **`tool-dep`** for T1595 (the tool decides scanning behavior)
- Agent receives scan results, reasons "port 443 is open with Apache 2.4.49, which is vulnerable to CVE-2021-41773," and then decides to exploit → **`covered`** for T1190 (the agent made the exploitation decision)

### 3.3 Label precedence rule

When multiple documented instances exist with conflicting outcomes (some success, some failure), use the **lower label**:
- ≥50% documented success rate across reported attempts → `covered`
- <50% success OR only easy scenarios succeed → `partial`

---

## 4. Evidence Requirements

### 4.1 Evidence tiers

Evidence must come from **primary sources**. In descending quality:

| Tier | Source type | Acceptable for |
|---|---|---|
| **T1** | Peer-reviewed paper with quantitative benchmark (e.g., per-technique success rate) | `covered`, `partial`, `not-covered` |
| **T2** | Official technical documentation or GitHub README with architectural specification (e.g., agent roster with explicit technique mapping) | `covered`, `partial`, `tool-dep` |
| **T3** | Case study in paper or blog post with step-by-step trace showing agent behavior | `covered`, `partial` |
| **T4** | Architecture description without demonstrated execution | `tool-dep` only — not sufficient for `covered` |

**T4 evidence alone cannot support `covered` or `partial`.**  
An agent having a "Web Exploitation module" does not mean T1190 is covered unless execution is demonstrated.

### 4.2 Citation format in papers.json

Every technique entry must include a `source` field:

```json
{
  "id": "T1595",
  "coverage": "covered",
  "notes": "Recon agent autonomously runs nmap; results written to Neo4j graph",
  "source": {
    "tier": "T2",
    "ref": "github.com/PurpleAILAB/Decepticon — Agent Roster: Recon section"
  }
}
```

If no source can be cited, the technique must be labeled `not-covered` or removed.

---

## 5. Decision Flowchart

```
For technique Txxxx and agent A:
│
├─ Is there primary source evidence (T1–T3) showing A applying Txxxx?
│   │
│   ├─ NO → label: not-covered
│   │
│   └─ YES ↓
│
├─ Does A make an autonomous decision to apply Txxxx (L2/L3)?
│   │
│   ├─ NO (human directed / L1) → label: not-covered
│   │
│   └─ YES ↓
│
├─ Does A's behavior match ATT&CK's technique definition?
│   │
│   ├─ NO (different behavior, similar tool) → label: not-covered
│   │
│   └─ YES ↓
│
├─ Does the agent contribute technique-specific reasoning,
│  or does the external tool do all the cognitive work?
│   │
│   ├─ Tool does all the work → label: tool-dep
│   │
│   └─ Agent reasons about technique ↓
│
└─ What is the success rate / scenario coverage?
    ├─ ≥50% success across reported attempts, or success in medium/hard scenarios → covered
    └─ <50% success, or only easy scenarios, or mid-technique human required → partial
```

---

## 6. Worked Examples

### Example A: PentestGPT + T1595 (Active Scanning)

**Evidence:** Deng et al. (2024) Section 4.1 — Generation Module invokes nmap as first step; PTT node is automatically created for network scanning.

**Autonomy check:** Agent autonomously decides to run nmap at session start (L3) — not prompted per-instance by human.

**Tool-dep check:** Agent parses nmap XML output and creates PTT subnodes based on discovered services → agent contributes reasoning beyond raw tool call.

**Outcome:** `covered` (T1, L3, architecture match)

---

### Example B: PentestGPT + T1021 (Remote Services / Lateral Movement)

**Evidence:** Deng et al. (2024) explicitly states: "PentestGPT is designed for single-machine penetration testing... lateral movement across hosts is out of scope."

**Outcome:** `not-covered` (T1, explicit out-of-scope statement)

---

### Example C: Decepticon + T1027 (Obfuscated Files / Information)

**Evidence:** GitHub docs list "Reverser agent" with Ghidra/radare2 for binary analysis, packer detection, ROP gadgets.

**ATT&CK behavior match check:** T1027 describes *adversaries obfuscating their own payloads* to evade detection. A Reverser agent *analyzing* obfuscated binaries is performing **detection/analysis**, not the T1027 adversarial behavior.

**Correct technique:** T1027 is wrong. The correct mapping for binary analysis during a pentest is: **T1587.001** (Develop Capabilities: Malware — if building exploit) or simply discovery-phase behavior without a specific ATT&CK T-number for the analysis step.

**Outcome:** Remove T1027; add note: "Binary analysis by Reverser agent — does not map to an adversarial technique in Enterprise ATT&CK (analysis ≠ obfuscation)"

---

### Example D: CAI + T1021 (Lateral Movement)

**Evidence:** No case study in arXiv 2504.06017 or official docs demonstrates CAI moving laterally between hosts. Primary case studies (Unitree G1, Ecoforest, MiR) are single-device targets. Dragos OT CTF does not involve network lateral movement in the enterprise sense.

**Outcome:** `not-covered`

---

## 7. Scope Limitations

### 7.1 This rubric covers Enterprise ATT&CK only

Agents primarily targeting OT/ICS (e.g., CAI's Dragos CTF scenarios) should have techniques mapped against **ICS ATT&CK** (https://attack.mitre.org/matrices/ics/), which is a separate matrix. Enterprise ATT&CK technique IDs (T1xxx) should not be applied to ICS-specific behaviors.

In `papers.json`, use `"matrix": "ics-attack"` for ICS-specific techniques.

### 7.2 Sub-techniques

When a paper provides enough specificity to identify a sub-technique (e.g., T1003.001 LSASS Memory, not just T1003 Credential Dumping), use the sub-technique. Do not claim the parent technique unless the agent demonstrably covers multiple sub-techniques.

### 7.3 "Coverage" ≠ "Effectiveness"

`covered` means the agent autonomously applied the technique in documented scenarios. It does not claim the technique was applied optimally, efficiently, or at state-of-the-art performance. Effectiveness is captured in the `benchmark` field, not the `coverage` label.

---

## 8. References

1. **Strom, B. E., et al. (2018).** "MITRE ATT&CK: Design and Philosophy." *MITRE Technical Report MTR180078.* https://attack.mitre.org/docs/ATTACK_Design_and_Philosophy_March_2020.pdf

2. **MITRE ATT&CK Evaluations Methodology.** https://attackevals.mitre-engenuity.org/methodology/ — Defines procedure-level evidence requirements for detection coverage scoring; this rubric adapts those principles for *generation* (offensive agent) coverage.

3. **Endsley, M. R., & Kaber, D. B. (1999).** "Level of automation effects on performance, situation awareness and workload in a dynamic control task." *Ergonomics, 42*(3), 462–492. — Source of the L1/L2/L3 autonomy framework adapted in Section 2.3.

4. **SAE International. (2021).** *SAE J3016_202104: Taxonomy and Definitions for Terms Related to Driving Automation Systems.* — Extended autonomy taxonomy; the L1–L3 labels in this rubric are analogous (not identical) to the SAE framework.

5. **Deng, G., et al. (2024).** "PentestGPT: An LLM Empowered Automatic Penetration Testing." *USENIX Security 2024.* arXiv:2308.06782 — Primary source for PentestGPT technique coverage; task-based evaluation methodology used as T1 evidence in this rubric.

6. **MITRE ATT&CK Enterprise Matrix v16.** https://attack.mitre.org/matrices/enterprise/ — Authoritative source for all T-number definitions and behavior descriptions cited in technique mappings.

7. **Atomic Red Team (Red Canary).** https://github.com/redcanaryco/atomic-red-team — Each atomic test maps exactly one procedure to one ATT&CK technique; used as a reference for what constitutes a "single technique instance" at the procedure level.

---

## 9. Changelog

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-05-18 | Initial rubric — covers Enterprise ATT&CK, 4 labels, 3 autonomy levels, 4 evidence tiers |
