# MITRE ATT&CK × Red Team AI Agent Visualization — Design Spec

**Date:** 2026-05-18  
**Status:** Approved

---

## Overview

A two-project monorepo:

1. **`app/`** — Static React + Vite SPA. Reads `papers.json` at build time. Deploys to Cloudflare Pages.
2. **`editor/`** — Local-only admin editor. React frontend + Express backend. Reads/writes `papers.json` directly. Never deployed.

Shared data file: `app/public/papers.json`

---

## Project Structure

```
red-team-ai-agent-summary/
├── app/                        # Cloudflare Pages target
│   ├── public/
│   │   └── papers.json         # All agent + paper + technique data
│   ├── src/
│   │   ├── data/
│   │   │   └── attack-enterprise.json   # MITRE ATT&CK v16 (trimmed)
│   │   ├── components/
│   │   │   ├── AgentTabs.tsx
│   │   │   ├── OverviewMatrix.tsx
│   │   │   ├── TacticSection.tsx
│   │   │   ├── TechniqueRow.tsx
│   │   │   └── PaperSidebar.tsx
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── vite.config.ts
│   └── package.json
├── editor/                     # Local admin editor (never deployed)
│   ├── server/
│   │   └── index.js            # Express: GET/POST /api/papers
│   ├── src/
│   │   ├── components/
│   │   │   ├── AgentList.tsx
│   │   │   ├── PaperForm.tsx
│   │   │   └── TechniqueSelector.tsx
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── package.json
└── docs/
    └── superpowers/specs/
        └── 2026-05-18-mitre-attack-agent-viz-design.md
```

---

## Data Schema: `papers.json`

```json
{
  "version": "1.0",
  "lastUpdated": "2026-05-18",
  "agents": [
    {
      "id": "artemis",
      "name": "ARTEMIS",
      "paper": {
        "title": "ARTEMIS: Automated Red Teaming at Enterprise Scale",
        "venue": "ICLR 2026",
        "year": 2025,
        "authors": ["Mark Niklas Müller", "et al."],
        "arxiv": "2512.09882",
        "url": "https://arxiv.org/abs/2512.09882",
        "affiliation": "ETH Zurich",
        "summary": "...",
        "tags": ["multi-agent", "enterprise", "GPT-5"]
      },
      "techniques": [
        { "id": "T1595", "notes": "Uses dynamic agents for active scanning" },
        { "id": "T1595.001", "notes": "" }
      ]
    }
  ]
}
```

## Data Schema: `attack-enterprise.json` (trimmed MITRE v16)

```json
{
  "tactics": [
    {
      "id": "TA0043",
      "name": "Reconnaissance",
      "techniques": [
        {
          "id": "T1595",
          "name": "Active Scanning",
          "sub_techniques": [
            { "id": "T1595.001", "name": "Scanning IP Blocks" },
            { "id": "T1595.002", "name": "Vulnerability Scanning" }
          ]
        }
      ]
    }
  ]
}
```

---

## App (`app/`) — UI Design

### Navigation
- Fixed top bar: logo + search/filter
- Scrollable agent tab strip (one tab per agent in `papers.json` + "Overview" tab)
- Active tab highlighted in orange

### Per-Agent View (default)
- **Left/Main panel**: ATT&CK tactics accordion
  - Each tactic shows technique count covered
  - Covered techniques: green left-border + dot indicator
  - Sub-techniques: indented, expandable
  - Uncovered techniques: dimmed (still visible for context)
- **Right sidebar** (300px): Paper info card
  - Title, venue, year, authors, tags
  - ATT&CK coverage stats (# tactics, # techniques covered)
  - Link to paper

### Overview Tab
- Matrix grid: rows = agents, columns = tactics (TA0043…)
- Cell = count of techniques covered by that agent in that tactic
- Color intensity = coverage density
- Click cell → filter to that agent+tactic view

---

## Editor (`editor/`) — Local Admin Tool

### Running
```bash
cd editor && npm run dev
# Opens http://localhost:5174
# Express backend on http://localhost:3001
```

### UI
- **Left sidebar**: Agent list (add / delete agent)
- **Main panel**: Tabbed — "Paper Info" | "Techniques"
  - Paper Info: form fields for all metadata
  - Techniques: full ATT&CK matrix, click to toggle covered/not covered, optional notes per technique
- **Save button**: POST to Express → writes `../app/public/papers.json`
- **Export hint**: "Run `cd app && npm run build` then deploy to Cloudflare Pages"

---

## ATT&CK Data Source

Pre-bundled static JSON (`app/src/data/attack-enterprise.json`) trimmed from MITRE ATT&CK Enterprise v16. Covers all 14 Enterprise tactics + ~200 techniques + sub-techniques. Generated once during project setup from MITRE's official STIX bundle; not fetched at runtime.

---

## Initial Agent List (from Obsidian notes)

| Agent | Type | Paper |
|-------|------|-------|
| ARTEMIS | Multi-agent, enterprise | ICLR 2026 |
| CAI | Framework / production tool | arXiv multi-paper |
| Decepticon | 16-agent autonomous | XBOW benchmark |
| HackSynth | Single-agent, CTF | arXiv 2024 |
| Red-MIRROR | Web pentest, 6-agent | arXiv 2026 |
| PentestAgent | Multi-stage, LLM | ASIA CCS 2025 |
| Pentest-R1 | RL-based reasoning | arXiv 2025 |
| LLMs-Hack-Enterprise-Networks | Enterprise assumed-breach | ACM 2025 |
| AutoPen | Autonomous pentest | ACM 2025 |

---

## Deployment

- `app/`: `npm run build` → `dist/` → Cloudflare Pages (static assets only)
- `editor/`: local only, never deployed
- `papers.json` is committed to repo; Cloudflare rebuilds on push

---

## Out of Scope

- Authentication / access control (static site, no secrets)
- Real-time sync (editor saves to file, deploy is manual)
- Auto-import from Obsidian (manual curation via editor)
