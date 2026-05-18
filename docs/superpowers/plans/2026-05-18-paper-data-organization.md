# Red Team AI Agent — Paper Data Organization Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Populate `app/public/papers.json` with complete ATT&CK-mapped coverage data for all target agents, simultaneously updating the Obsidian research task table in `APT-GPT/20260517.md`.

**Architecture:** Two parallel output streams per agent — (1) structured JSON for the viz app, (2) prose table rows for Obsidian. Both share the same three-layer framework: ATT&CK Tactic → Technique → agent coverage. Priority order is Prof. Wei-mandated: PentestGPT → Decepticon → CAI, then remaining 有論文 agents, then 無論文 agents.

**Deadline:** 2026-05-25 (next weekly meeting)

**Output files:**

- `app/public/papers.json` (viz app data source)
- `APT-GPT/20260517.md` → Task 1.1 table (Obsidian notes)

---

## Phase 0.5 — Manual Technique Verification (手動驗證，隨時可做)

> **Why this phase exists:** Technique mappings filled so far are inferred from partial Obsidian notes — not from reading actual papers. This phase is a manual checklist to verify each claim against the primary source (arXiv / GitHub docs).
>
> **Confidence levels assigned at fill time:**
>
> - 🟢 High — from detailed notes with explicit evidence (tool names, code paths, benchmark breakdown)
> - 🟡 Medium — inferred from description or general agent behavior
> - 🔴 Low — estimated, no paper section found to confirm

### Verification Rubric

A technique is **verified** when you can point to a specific section in the paper that:

- Shows the agent autonomously **decides** to use this technique (not just passively runs a tool)
- Or shows a tool that directly implements this technique being called by the agent
- For `not-covered`: paper explicitly states the limitation, OR benchmark shows 0% in that category

Coverage label meanings:

- `covered` = agent autonomously executes in ≥1 benchmark scenario
- `partial` = agent attempts but requires human help, often fails, or only in easy scenarios
- `tool-dep` = external tool does the work; agent only parses output
- `not-covered` = explicitly out of scope or 0% in relevant scenarios

---

### 2a. PentestGPT Verification Checklist

**Primary source:** arXiv 2308.06782 — read Section 3 (PTT), Section 4 (modules), Section 5 (eval)

| Technique | Current label | Confidence | What to verify in paper | Verified |
|---|---|---|---|---|
| T1595 Active Scanning | covered | 🟢 | Confirm nmap is invoked autonomously by Reasoning module | **True** — Section 4.1: Generation Module invokes nmap; PTT node auto-created (T1 evidence) |
| T1046 Network Service Discovery | covered | 🟢 | Confirm from nmap output parsing section | **True** — service detection via nmap XML parsing; implicit in Generation Module design |
| T1083 File Discovery | covered | 🟡 | Find where dirbuster context explosion is documented | **True** — dirbuster context explosion cited as limitation (Sec.5); file discovery is core recon step |
| T1190 Exploit Public-Facing App | covered | 🟢 | Web vulns are primary target — confirm in eval | **True** — Section 5: web app exploitation is primary benchmark category (T1 evidence) |
| T1059 Command Execution | partial | 🟡 | Find which shell interactions fail / need human | **Uncertain** — shell generation throughout; partial consistent with Hard=0/2; confirm Section 4 |
| T1518 Software Discovery | tool-dep | 🔴 | Check if paper mentions software enumeration explicitly | False (Seems like not mentioned? Or plz give me ref) ✅ correct — recommend remove |
| T1082 System Info | tool-dep | 🔴 | Check if paper mentions system info collection | False I cannot find any ref (maybe it is) ✅ correct — recommend remove |
| T1548 Privilege Escalation | partial | 🔴 | Does paper discuss privesc at all? Hard=0/2 may mean no privesc | True(Some of it might included privesc or maybe not) ⚠️ 🔴 confidence = no source; closed-world rule → **False**, recommend change to `not-covered` |
| T1021 Lateral Movement | not-covered | 🟢 | Paper explicitly says no multi-host design | **True** (not-covered confirmed) — paper explicitly: "single-machine…lateral movement out of scope" |
| T1008 Fallback Channels | not-covered | 🔴 | Remove if paper doesn't discuss C2 at all | False ✅ correct, but ⚠️ reasoning wrong: T1008=C2 Fallback Channels (不是 Lateral Movement)；理由是 PentestGPT 無 C2 機制，不是 single-VM |

- [ ] Read arXiv 2308.06782 Section 5 (Evaluation) — note exact failure categories
- [ ] Confirm or remove T1518, T1082, T1008 entries (likely over-mapped)
- [ ] Update `papers.json` with verified labels + add `"verified": true` flag to confirmed techniques
- [ ] Note paper section reference in `notes` field for each verified technique

---

### 2b. Decepticon Verification Checklist

**Primary source:** GitHub docs (https://docs.decepticon.red) + agent roster documentation  
**Confidence baseline:** High — notes came from official docs, not secondary sources

| Technique | Current label | Confidence | What to verify | Verified |
|---|---|---|---|---|
| T1595, T1590, T1589, T1592 | covered | 🟢 | Recon agent description is explicit — low risk | **True** — GitHub docs Agent Roster: Recon agent explicitly lists nmap, whatweb, sublist3r (T2 evidence) |
| T1190 | covered | 🟢 | Exploit agent: SQLi, SSTI, ADCS — explicitly documented | **True** — GitHub docs: Exploit agent section lists SQLi, SSTI, ADCS (T2 evidence) |
| T1059 | covered | 🟢 | tmux + prompt detection for msfconsole/evil-winrm — documented | **True** — GitHub docs: tmux session management + shell prompt detection for msfconsole/evil-winrm |
| T1068, T1548 | covered | 🟡 | Post-Exploit agent listed — verify specific privesc techniques | **Uncertain** — Post-Exploit agent in roster; specific Linux/Windows privesc binaries not explicitly listed |
| T1003, T1003.001 | covered | 🟢 | mimikatz explicit in Post-Exploit agent | **True** — GitHub docs: Post-Exploit agent uses mimikatz → T1003.001 (LSASS Memory) explicit |
| T1558 | covered | 🟢 | Kerberoasting, AS-REP explicitly listed for AD Operator | **True** — GitHub docs AD Operator: GetSPN, AS-REP roasting explicitly listed |
| T1649 | covered | 🟢 | certipy ESC1-ESC15 explicitly listed | **True** — GitHub docs AD Operator: certipy ESC1–ESC15 explicitly listed |
| T1087, T1482 | covered | 🟢 | BloodHound path analysis explicit | **True** — GitHub docs: BloodHound/SharpHound for AD path analysis explicit |
| T1021, T1550 | covered | 🟡 | Lateral movement via evil-winrm + pass-the-hash — verify sequence | **Uncertain** — evil-winrm listed; pass-the-hash implied; execution sequence not explicitly documented as autonomous decision |
| T1027 | covered | 🟡 | Reverser agent: Ghidra/radare2 listed, but T1027 is obfuscation analysis, not execution — check if label is correct | **False** — T1027=adversary obfuscates own payload; Reverser ANALYZES obfuscated binaries (defender behavior); wrong technique — remove T1027 |
| T1526, T1537 | covered/partial | 🟡 | Cloud Hunter agent listed but specific techniques need docs verification | **Uncertain** — Cloud Hunter in roster; specific IAM/S3/K8s T-IDs not confirmed in docs |

- [ ] Verify T1027 label — Reverser does binary analysis, but T1027 (Obfuscated Files) may not be the right technique; consider T1055 (Process Injection) or just remove
- [ ] Confirm Cloud Hunter techniques from docs — find specific IAM, S3, K8s technique IDs
- [ ] Find the 12.5% failure case (1/8 XBOW) in any blog post or GitHub issue
- [ ] Update papers.json with corrected labels

---

### 2c. CAI Verification Checklist

**Primary source:** arXiv 2504.06017 + GitHub README + case study blog posts  
**Confidence baseline:** Low for Enterprise ATT&CK (OT/ICS is primary)

| Technique | Current label | Confidence | What to verify | Verified |
|---|---|---|---|---|
| T1595 Active Scanning | covered | 🟡 | Check if CAI runs nmap or delegates to built-in tools | **Uncertain** — CAI uses built-in security tools; nmap likely available but whether L3 autonomous decision is documented unclear |
| T1190 Exploit Public-Facing App | covered | 🟢 | PortSwigger race condition + Mercado Libre API — case study documented | **True** — arXiv 2504.06017 Sec.4: PortSwigger race condition + Mercado Libre API exploitation (T3 evidence) |
| T1552 Credentials in Files | covered | 🟢 | Unitree RSA key world-writable — case study documented | **True** — arXiv 2504.06017: Unitree G1 world-readable RSA private key (T3 evidence) |
| T1083 File Discovery | covered | 🔴 | Generic assumption — remove if not documented | True (for mentioned CTF Chal its all included flag file reading and ls for the path of the flag file) ⚠️ CTF flag-reading may count, but needs arXiv 2504.06017 section ref to confirm — verify before keeping |
| T1059 Command Execution | covered | 🟡 | Confirm from built-in security tools documentation | **Uncertain** — command execution implied by tool usage; confirm from arXiv 2504.06017 Section 2 |
| T1498 Network DoS | not-covered | 🔴 | Remove — irrelevant and not mentioned anywhere | False (for CTF chal might not tolerate) ✅ correct — remove entry entirely |
| T1021 Lateral Movement | partial | 🔴 | No case study shows lateral movement — likely remove or mark not-covered | False ✅ correct — all 4 case studies are single-target; change label to `not-covered` |
| T1548 Privilege Escalation | partial | 🔴 | No specific case study — likely remove | True(for some of chal will need to privesc for reading or accessing the flag file) ⚠️ ICS CTF privesc ≠ Enterprise T1548; needs specific arXiv section ref; keep as partial with caveat pending verification |

- [ ] Read arXiv 2504.06017 abstract + Section 2 (architecture) + Section 4 (case studies)
- [ ] Remove T1498 (DoS) — incorrect
- [ ] Re-evaluate T1021 and T1548 — likely over-mapped for Enterprise scope
- [ ] Check if ICS ATT&CK techniques should be added separately (OT case studies map to different matrix)
- [ ] Consider adding `"matrix": "ics-attack"` flag for OT-specific techniques
- [ ] Update papers.json with corrected labels

---

### Verification Tracking

| Agent      | Paper Read      | Techniques Verified | papers.json Updated |
| ---------- | --------------- | ------------------- | ------------------- |
| PentestGPT | - [ ]           | - [ ]               | - [ ]               |
| Decepticon | - [ ]           | - [ ]               | - [ ]               |
| CAI        | - [ ]           | - [ ]               | - [ ]               |
| ARTEMIS    | pending Phase 3 | pending             | pending             |
| Red-MIRROR | pending Phase 3 | pending             | pending             |
| HackSynth  | pending Phase 3 | pending             | pending             |

> ⚠️ **Note:** For Phase 3 agents, fill + verify in one pass (read paper → map → verify → commit). Don't split fill and verify into separate rounds.

---

## Three-Layer Framework Reference

Every agent analysis must answer these three layers explicitly:

```
Layer 1 — ATT&CK Tactic (which phases?)
  TA0043 Reconnaissance
  TA0001 Initial Access
  TA0002 Execution
  TA0004 Privilege Escalation
  TA0005 Defense Evasion
  TA0006 Credential Access
  TA0007 Discovery
  TA0008 Lateral Movement
  TA0003 Persistence
  TA0011 Command and Control
  TA0010 Exfiltration / TA0040 Impact

Layer 2 — Technique (specific T-IDs the agent uses or automates)
  e.g. T1595 (Active Scanning), T1190 (Exploit Public-Facing App)

Layer 3 — Coverage assessment
  Covered  = agent autonomously executes or decides this technique
  Partial  = agent attempts but requires human assist or often fails
  Tool-dep = agent calls an external tool that performs the technique
  Not covered = explicitly fails or out of scope
```

---

## papers.json Entry Template

Copy this for each new agent:

```json
{
    "id": "<slug>",
    "name": "<Display Name>",
    "paper": {
        "title": "",
        "venue": "",
        "year": 0,
        "authors": [],
        "arxiv": "",
        "url": "",
        "affiliation": "",
        "summary": "",
        "tags": []
    },
    "benchmark": {
        "dataset": "",
        "score": "",
        "notes": ""
    },
    "limitations": [
        "<concrete failure — no adjectives, include numbers or specific scenario>"
    ],
    "techniques": [
        {
            "id": "T1xxx",
            "coverage": "covered|partial|tool-dep|not-covered",
            "notes": ""
        }
    ]
}
```

---

## Obsidian Table Row Template

For each agent, add/update this row in `APT-GPT/20260517.md` Task 1.1:

```
| **<Name>** | <arch type> | <benchmark score> | <concrete limitation — specific scenario/number/missing mechanism> | <improvement angle> |
```

---

## Phase 1 — Foundation (Do First, ~30 min)

### Task 0: papers.json skeleton

**Files:**

- Create/verify: `app/public/papers.json`

- [ ] **Step 1: Check current state**

```bash
cat app/public/papers.json 2>/dev/null || echo "File does not exist"
```

- [ ] **Step 2: Initialize with schema header if empty**

Write to `app/public/papers.json`:

```json
{
    "version": "1.0",
    "lastUpdated": "2026-05-18",
    "agents": []
}
```

- [ ] **Step 3: Commit baseline**

```bash
git add app/public/papers.json
git commit -m "data: initialize papers.json schema"
```

---

## Phase 2 — Key Papers (Priority 1, deadline 2026-05-25)

> Prof. Wei instruction (2026-05-18 meeting): These three are the mandatory comparison targets. Read first.

---

### Task 1: PentestGPT

**Source:** arXiv 2308.06782 / GitHub `GreyDGL/PentestGPT`  
**Why priority:** First major LLM pentest agent; no role-playing; baseline to beat

**Files:**

- Modify: `app/public/papers.json` → add entry under `agents`
- Modify: `APT-GPT/20260517.md` → update Task 1.1 PentestGPT row

- [ ] **Step 1: Locate and read paper**

Primary source: https://arxiv.org/abs/2308.06782  
Read sections: Abstract, Section 3 (PTT architecture), Section 4 (modules), Section 5 (evaluation)

Key questions to answer while reading:

1. Which ATT&CK tactics does it cover? (look for explicit attack phases)
2. What is the exact benchmark score breakdown? (easy/medium/hard separately)
3. What causes failures? (look for "limitation", "failed", "unable to")
4. Does it have role differentiation? Memory? Reflection?

- [ ] **Step 2: Fill ATT&CK coverage table**

Map each of PentestGPT's actions to technique IDs. Minimum expected coverage:

| Tactic                      | Expected techniques               | Notes to verify                  |
| --------------------------- | --------------------------------- | -------------------------------- |
| TA0043 Recon                | T1595 (Active Scanning)           | Does it run nmap autonomously?   |
| TA0001 Initial Access       | T1190 (Exploit Public-Facing App) | Web vulns                        |
| TA0007 Discovery            | T1082, T1083                      | Service/file enumeration         |
| TA0008 Lateral Movement     | ?                                 | Check if multi-host is supported |
| TA0004 Privilege Escalation | ?                                 | Does it attempt privesc?         |

- [ ] **Step 3: Add to papers.json**

Insert into `agents` array. Use concrete failure data from paper:

```json
{
    "id": "pentestgpt",
    "name": "PentestGPT",
    "paper": {
        "title": "PentestGPT: An LLM Empowered Automatic Penetration Testing",
        "venue": "USENIX Security 2024",
        "year": 2024,
        "authors": ["Gelei Deng", "et al."],
        "arxiv": "2308.06782",
        "url": "https://arxiv.org/abs/2308.06782",
        "affiliation": "Nanyang Technological University",
        "summary": "PTT (Penetration Testing Tree) + 3-module LLM framework. Single agent with session manager, operation generator, result parser.",
        "tags": ["single-agent", "PTT", "web", "CTF"]
    },
    "benchmark": {
        "dataset": "Custom HackTheBox-style machines (13 total)",
        "score": "61.54% (8/13); Hard: 0/2",
        "notes": "Context explosion from dirbuster output; no multi-host support"
    },
    "limitations": [
        "Hard difficulty machines: 0/2 solved",
        "dirbuster/gobuster output causes context overflow — no compression mechanism",
        "No multi-host lateral movement design",
        "No role differentiation — single LLM for all decisions"
    ],
    "techniques": []
}
```

Fill in `techniques` array from Step 2.

- [ ] **Step 4: Update Obsidian table**

In `APT-GPT/20260517.md` Task 1.1, confirm PentestGPT row has concrete limitations (no adjectives). Update if paper reveals more specific data.

- [ ] **Step 5: Commit**

```bash
git add app/public/papers.json
git commit -m "data: add PentestGPT agent entry with ATT&CK coverage"
```

---

### Task 2: Decepticon

**Source:** GitHub `PurpleAILAB/Decepticon` + associated paper (XBOW benchmark)  
**Why priority:** Highest benchmark score (87.5% XBOW Hard); closest to MARS architecture in agent count; has Neo4j KG

**Files:**

- Modify: `app/public/papers.json`
- Modify: `APT-GPT/20260517.md`

- [ ] **Step 1: Locate paper and source**

Check GitHub README for paper link. Search: "Decepticon autonomous hacking agent XBOW"  
Fallback: read GitHub repo README + source code architecture docs

Key questions:

1. 16 agents — what are each agent's roles? Map to ATT&CK tactics
2. Fresh context: how exactly does it work? What gets lost between sessions?
3. What is the Neo4j findings graph schema? Does it map to ATT&CK?
4. XBOW Hard 87.5% — what is the 12.5% that fails?

- [ ] **Step 2: Map 16 agents to ATT&CK tactics**

Each specialized agent likely maps to one or more tactics:

| Agent role (hypothesized) | ATT&CK Tactic           | Verify in paper |
| ------------------------- | ----------------------- | --------------- |
| Recon agent               | TA0043                  | T1595, T1592    |
| Web exploitation agent    | TA0001                  | T1190           |
| AD/Windows agent          | TA0004, TA0006          | T1558, T1003    |
| Reverser                  | (analysis, pre-exploit) | —               |
| Post-exploit agent        | TA0008                  | T1021           |
| Lateral movement agent    | TA0008                  | T1550           |

- [ ] **Step 3: Add to papers.json**

```json
{
    "id": "decepticon",
    "name": "Decepticon",
    "paper": {
        "title": "[verify exact title from paper]",
        "venue": "[verify venue]",
        "year": 2025,
        "authors": [],
        "arxiv": "[fill if exists]",
        "url": "https://github.com/PurpleAILAB/Decepticon",
        "affiliation": "[fill]",
        "summary": "16 specialized agents orchestrated via LangGraph. Neo4j findings graph. Achieved 87.5% on XBOW Hard benchmark.",
        "tags": ["multi-agent", "LangGraph", "Neo4j", "AD", "autonomous"]
    },
    "benchmark": {
        "dataset": "XBOW Hard benchmark",
        "score": "87.5%",
        "notes": "Fresh context per session — no cross-session learning"
    },
    "limitations": [
        "Fresh context rebuilt each session: no cross-session knowledge accumulation",
        "Neo4j stores findings graph only, not attack knowledge graph (no ATT&CK mapping)",
        "No Tactic-level reflection: agent does not reason about which ATT&CK stage it's at",
        "[12.5% failure cases — find in paper]"
    ],
    "techniques": []
}
```

- [ ] **Step 4: Update Obsidian + commit**

```bash
git add app/public/papers.json
git commit -m "data: add Decepticon agent entry with ATT&CK coverage"
```

---

### Task 3: CAI (aliasrobotics/cai)

**Source:** arXiv 2504.06017 + existing notes at `Red Team/CAI.md`  
**Why priority:** Production framework with OT/IoT CTF wins; Handoffs architecture reusable for MARS v2

**Files:**

- Modify: `app/public/papers.json`
- Read: `Red Team/CAI.md` (already written — use as data source)

- [ ] **Step 1: Read existing notes**

```
Notes at: ~/Library/Mobile Documents/iCloud~md~obsidian/Documents/notes/Red Team/CAI.md
```

Extract from existing notes:

- Architecture (Handoffs + Guardrails + HITL)
- Benchmark: Dragos OT CTF Rank 1 (32/34, +37% vs humans)
- ATT&CK coverage (likely OT/ICS-heavy: ICS ATT&CK, not Enterprise)
- Limitations already listed

- [ ] **Step 2: Verify OT vs Enterprise ATT&CK scope**

CAI focuses on OT/IoT. Check if Enterprise ATT&CK applies or if ICS ATT&CK matrix is more appropriate.

- If ICS: note in `techniques` that this agent targets ICS ATT&CK, not Enterprise
- If both: map Enterprise techniques covered + note ICS primary

- [ ] **Step 3: Add to papers.json**

```json
{
    "id": "cai",
    "name": "CAI",
    "paper": {
        "title": "CAI: An Open, Bug Bounty-Ready Cybersecurity AI",
        "venue": "arXiv 2025",
        "year": 2025,
        "authors": ["aliasrobotics team"],
        "arxiv": "2504.06017",
        "url": "https://arxiv.org/abs/2504.06017",
        "affiliation": "aliasrobotics",
        "summary": "Modular cybersecurity AI framework. Handoffs-based agent routing, Guardrails for injection defense, HITL checkpoints. 300+ model support.",
        "tags": [
            "framework",
            "handoffs",
            "OT",
            "IoT",
            "production",
            "bug-bounty"
        ]
    },
    "benchmark": {
        "dataset": "Dragos ICS/OT CTF (34 challenges)",
        "score": "32/34 (94.1%), Rank 1; +37% vs human teams",
        "notes": "OT/ICS focus; HackerOne bug bounty validated in production"
    },
    "limitations": [
        "No global attack knowledge graph: agent selection is Handoffs-based, not ATT&CK-driven",
        "No persistent memory stream across sessions",
        "Strongest models (Opus) available only in paid tier",
        "[verify: any Enterprise network ATT&CK gaps from paper]"
    ],
    "techniques": []
}
```

- [ ] **Step 4: Update Obsidian + commit**

```bash
git add app/public/papers.json
git commit -m "data: add CAI agent entry with ATT&CK coverage"
```

---

## Phase 3 — Remaining 有論文 Agents

> Do after Phase 2. One task per agent, same structure as Tasks 1–3.

### Task 4: ARTEMIS

**Source:** arXiv 2512.09882  
**Key data to extract:** $18.21/hr cost breakdown, 18% false positive rate causes, GUI task failure mechanism

- [ ] Read paper focusing on: cost model, triage mechanism, failure taxonomy
- [ ] Map to ATT&CK (enterprise network — real company target)
- [ ] Add to papers.json (fill benchmark: 9 vulns, 82% effective)
- [ ] Commit: `data: add ARTEMIS agent entry`

### Task 5: Red-MIRROR

**Source:** arXiv (search "Red-MIRROR SRM Dual-Phase Reflection")  
**Key data to extract:** SRM mechanism, why Binary exploitation = 0%, Web-only scope boundary

- [ ] Read paper focusing on: SRM design, XBOW Web 86%, binary fail reason
- [ ] Map to ATT&CK (Web-focused: T1190, T1059, T1505)
- [ ] Add to papers.json
- [ ] Commit: `data: add Red-MIRROR agent entry`

### Task 6: HackSynth

**Source:** arXiv (search "HackSynth Planner Summarizer CTF")  
**Key data to extract:** Context growth mechanism, why binary = 0%, PicoCTF 34.2% breakdown

- [ ] Read paper focusing on: Summarizer design, context limit behavior, CTF category breakdown
- [ ] Map to ATT&CK (CTF-focused: likely Recon + Initial Access + Execution)
- [ ] Add to papers.json
- [ ] Commit: `data: add HackSynth agent entry`

### Task 7: PentestAgent (Asia CCS '25)

**Source:** ACM CCS 2025 (search "PentestAgent LLM penetration testing nbshenxm")  
**Key data to extract:** Why 46% HackTheBox, inter-agent communication absent, sequential pipeline bottleneck

- [ ] Read paper focusing on: 4-agent pipeline design, inter-agent communication (or lack of), failure cases
- [ ] Map to ATT&CK
- [ ] Add to papers.json
- [ ] Commit: `data: add PentestAgent entry`

### Task 8: MAPTA

**Source:** arXiv or GitHub (search "MAPTA coordinator sandbox agents validation XBOW")  
**Key data to extract:** Why 76.9% single-agent mode, why enterprise = 0 findings, sandbox validation mechanism

- [ ] Read paper
- [ ] Add to papers.json
- [ ] Commit: `data: add MAPTA entry`

### Task 9: VulnBot

**Source:** arXiv (search "VulnBot multi-agent penetration testing XBOW 6%")  
**Note:** Negative example — multi-agent without mechanism → 6% XBOW

- [ ] Read paper focusing on: what mechanisms are missing, why Metasploitable 67% ≠ XBOW 6%
- [ ] Add to papers.json with `tags: ["negative-example", "multi-agent-no-mechanism"]`
- [ ] Commit: `data: add VulnBot entry (negative example)`

### Task 10: Pentest-R1 + AutoPen + LLMs-Hack-Enterprise-Networks

Three smaller papers — one commit per paper, same structure.

- [ ] **Pentest-R1**: arXiv 2025, two-stage RL. Read → map ATT&CK → add entry → commit
- [ ] **AutoPen**: ACM 2025, autonomous pentest. Read → map → add → commit
- [ ] **LLMs-Hack-Enterprise-Networks**: ACM 2025, assumed-breach enterprise. Read → map → add → commit

---

## Phase 4 — 無論文 Agents (GitHub-based assessment)

> For agents with no paper: use GitHub README + source code + issues/blog posts.
> Coverage mapping is based on stated features, not validated benchmark.
> Add `"has_paper": false` flag to entry.

### Task 11: pentagi + Shannon + Cairn + Dark-Moon

For each:

- [ ] Read GitHub README + any linked blog posts
- [ ] Estimate ATT&CK coverage from stated features (mark all as `"coverage": "partial"` if unverified)
- [ ] Add to papers.json with `"has_paper": false, "tags": ["no-paper", ...]`
- [ ] Add to Obsidian 20260517.md Task 2.5 status column
- [ ] Commit per agent

---

## Phase 5 — Weapons (Tools) Coverage

> Weapons are not in papers.json (tools don't have agent entries).
> This phase produces a separate `tools.json` or a `tools` array in papers.json.
> Output feeds the "Weapons" column in Obsidian 20260517.md Task 1.2.

**Schema for tools:**

```json
{
    "tools": [
        {
            "id": "nmap",
            "name": "nmap",
            "type": "recon",
            "techniques": [
                { "id": "T1595", "name": "Active Scanning" },
                { "id": "T1046", "name": "Network Service Discovery" }
            ],
            "automation_difficulty": "easy",
            "used_by": ["pentestgpt", "decepticon", "artemis"],
            "notes": "XML output parseable; standard first step in all agents"
        }
    ]
}
```

### Task 12: Map all weapons to MITRE Techniques

**Tools to map** (from Obsidian 20260517.md Task 1.2):

- [ ] **nmap** → T1595 (Active Scanning), T1046 (Network Service Discovery)
- [ ] **sqlmap** → T1190 (Exploit Public-Facing App), T1059.006 (Python for SQLi delivery)
- [ ] **Metasploit** → T1190, T1059 (Execution), T1548 (Privilege Escalation), T1021 (Lateral)
- [ ] **BloodHound/SharpHound** → T1087 (Account Discovery), T1482 (Domain Trust Discovery)
- [ ] **certipy** → T1649 (Steal/Forge Auth Certs), ESC1–ESC15 sub-techniques
- [ ] **mimikatz** → T1003 (OS Credential Dumping): T1003.001 (LSASS Memory)
- [ ] **evil-winrm** → T1021.006 (Remote Services: Windows Remote Management)
- [ ] **nuclei** → T1595.002 (Vulnerability Scanning)
- [ ] **Ghidra/radare2** → T1027 (Obfuscated Files/Info, analysis side)
- [ ] **gobuster/dirbuster** → T1595.003 (Wordlist Scanning), T1083 (File Discovery)
- [ ] **RustScan** → T1595.001 (Scanning IP Blocks)
- [ ] **NetExec (CrackMapExec)** → T1021.002 (SMB/Windows Admin Shares), T1110 (Brute Force)
- [ ] **Atomic Red Team** → Knowledge source only; no direct technique execution
- [ ] **CALDERA** → Framework covering full ATT&CK chain (note: adversary emulation, not pentesting)
- [ ] **Chisel** → T1090 (Proxy), T1572 (Protocol Tunneling)

Add `tools` array to `app/public/papers.json` (or separate `tools.json` — decide at time of implementation based on whether viz app needs tools).

- [ ] **Commit**

```bash
git add app/public/papers.json
git commit -m "data: add weapons/tools ATT&CK technique mapping"
```

---

## Phase 6 — Verification

### Task 13: Data completeness check

- [ ] **Verify all required agents are in papers.json**

```bash
node -e "
const d = require('./app/public/papers.json');
console.log('Agents:', d.agents.map(a => a.id));
console.log('Total:', d.agents.length);
const missing = ['pentestgpt','decepticon','cai','artemis','red-mirror','hacksynth','pentestagent','mapta','vulnbot'].filter(id => !d.agents.find(a => a.id === id));
console.log('Missing:', missing);
"
```

- [ ] **Verify no agent has empty techniques array**

```bash
node -e "
const d = require('./app/public/papers.json');
const empty = d.agents.filter(a => a.techniques.length === 0);
console.log('Agents with no techniques:', empty.map(a => a.id));
"
```

- [ ] **Verify all T-IDs are valid format** (T[0-9]{4} or T[0-9]{4}.[0-9]{3})

```bash
node -e "
const d = require('./app/public/papers.json');
const re = /^T\d{4}(\.\d{3})?$/;
d.agents.forEach(a => {
  a.techniques.forEach(t => {
    if (!re.test(t.id)) console.log(a.id, 'invalid:', t.id);
  });
});
console.log('Validation complete');
"
```

- [ ] **Cross-check with Obsidian table**

Open `APT-GPT/20260517.md` Task 1.1 — every agent in that table should have a papers.json entry.

- [ ] **Final commit**

```bash
git add app/public/papers.json
git commit -m "data: complete papers.json population for viz app"
```

---

## Division of Labor

Per Prof. Wei's suggestion (2026-05-18 meeting):

| Track                     | Scope                                                                                                                                            | Deadline   |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| **Track A (有論文)**      | Tasks 1–10: PentestGPT, Decepticon, CAI, ARTEMIS, Red-MIRROR, HackSynth, PentestAgent, MAPTA, VulnBot, Pentest-R1, AutoPen, LLMs-Hack-Enterprise | 2026-05-25 |
| **Track B (無論文/工具)** | Tasks 11–12: pentagi, Shannon, Cairn, Dark-Moon + all weapons                                                                                    | 2026-05-25 |

Tracks A and B can run in parallel after Task 0.

---

## Connection to Visual Project

Once papers.json is populated, the viz app (`2026-05-18-mitre-attack-agent-viz.md` implementation plan) can be executed. The data pipeline is:

```
Academic paper reading (this plan)
    ↓
papers.json population (Phase 2–5)
    ↓
editor/ tool for ongoing maintenance
    ↓
app/ React SPA → Cloudflare Pages
    ↓
Three-layer ATT&CK visualization
```

The editor/ tool (from the code plan) lets you update papers.json without re-running this research process — useful when new papers come out or after implementing the agent and verifying coverage empirically.

---

## Progress Tracking (update as tasks complete)

| Phase | Task                 | Status | Notes                                         |
| ----- | -------------------- | ------ | --------------------------------------------- |
| 1     | papers.json skeleton | - [x]  | committed 502dda8                             |
| 2     | PentestGPT           | - [x]  | 10 techniques; committed 1f7c826              |
| 2     | Decepticon           | - [x]  | 22 techniques (21 covered); committed 1f7c826 |
| 2     | CAI                  | - [x]  | 9 techniques; OT primary; committed 1f7c826   |
| 3     | ARTEMIS              | - [ ]  |                                               |
| 3     | Red-MIRROR           | - [ ]  |                                               |
| 3     | HackSynth            | - [ ]  |                                               |
| 3     | PentestAgent         | - [ ]  |                                               |
| 3     | MAPTA                | - [ ]  |                                               |
| 3     | VulnBot              | - [ ]  | Negative example                              |
| 3     | Pentest-R1           | - [ ]  |                                               |
| 3     | AutoPen              | - [ ]  |                                               |
| 3     | LLMs-Hack-Enterprise | - [ ]  |                                               |
| 4     | pentagi              | - [ ]  | No paper                                      |
| 4     | Shannon              | - [ ]  | No paper                                      |
| 4     | Cairn + Dark-Moon    | - [ ]  | No paper                                      |
| 5     | Weapons mapping      | - [ ]  |                                               |
| 6     | Verification         | - [ ]  |                                               |
