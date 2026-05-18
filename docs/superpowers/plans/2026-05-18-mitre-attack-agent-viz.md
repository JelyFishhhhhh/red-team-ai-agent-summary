# MITRE ATT&CK × Red Team AI Agent Visualization — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static React SPA deployable to Cloudflare Pages that maps red-team AI agents to MITRE ATT&CK Enterprise techniques, plus a local-only editor app to maintain the data.

**Architecture:** Monorepo with two Vite+React+TypeScript apps — `app/` (static build → Cloudflare Pages, reads `public/papers.json`) and `editor/` (local only, React frontend on :5174 + Express backend on :3001 that reads/writes `app/public/papers.json`). Shared ATT&CK data lives at `app/src/data/attack-enterprise.json`.

**Tech Stack:** React 18, TypeScript 5, Vite 5, Express 4, Vitest, plain CSS (custom properties, dark theme)

---

## File Map

```
red-team-ai-agent-summary/
├── .gitignore
├── LICENSE
├── README.md
├── scripts/
│   └── fetch-attack-data.js       # one-time script: download + trim MITRE STIX v16
├── app/                           # → Cloudflare Pages
│   ├── public/
│   │   └── papers.json            # all agent + paper + technique data (source of truth)
│   ├── src/
│   │   ├── data/
│   │   │   └── attack-enterprise.json   # trimmed MITRE ATT&CK v16 (committed)
│   │   ├── types/
│   │   │   └── index.ts           # Agent, Paper, Technique, Tactic, OverviewCell types
│   │   ├── utils/
│   │   │   └── attack.ts          # pure helpers: isCovered, getCoverage, buildMatrix
│   │   ├── hooks/
│   │   │   └── useData.ts         # fetch papers.json, import attack data, merge
│   │   ├── components/
│   │   │   ├── AgentTabs.tsx
│   │   │   ├── TacticSection.tsx
│   │   │   ├── TechniqueRow.tsx
│   │   │   ├── PaperSidebar.tsx
│   │   │   └── OverviewMatrix.tsx
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── package.json
├── editor/                        # local only — never deployed
│   ├── server/
│   │   └── index.js               # Express: GET+POST /api/papers, GET /api/attack
│   ├── src/
│   │   ├── types/
│   │   │   └── index.ts           # same Agent/Paper/Technique types (copy from app)
│   │   ├── components/
│   │   │   ├── AgentList.tsx
│   │   │   ├── PaperForm.tsx
│   │   │   └── TechniqueSelector.tsx
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── package.json
└── docs/
    └── superpowers/
        ├── specs/2026-05-18-mitre-attack-agent-viz-design.md
        └── plans/2026-05-18-mitre-attack-agent-viz.md
```

---

## Task 1: Git init + root files

**Files:**
- Create: `.gitignore`
- Create: `LICENSE`
- Create: `README.md` (skeleton — full content added in Task 13)

- [ ] **Step 1: Init git repo**

```bash
cd /Users/jelyf1shhhhhh/Documents/code/red-team-ai-agent-summary
git init
```

- [ ] **Step 2: Create `.gitignore`**

```
# deps
node_modules/
.pnp
.pnp.js

# build outputs
app/dist/
editor/dist/

# vite
*.local

# env
.env
.env.*
!.env.example

# brainstorm artifacts
.superpowers/

# macOS
.DS_Store
*.DS_Store
```

Save to `.gitignore`.

- [ ] **Step 3: Create `LICENSE` (MIT)**

```
MIT License

Copyright (c) 2026

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

Save to `LICENSE`.

- [ ] **Step 4: Create skeleton `README.md`** (one line placeholder — Task 13 fills it)

```markdown
# RedTeam AI × MITRE ATT&CK
```

- [ ] **Step 5: Initial commit**

```bash
git add .gitignore LICENSE README.md docs/
git commit -m "chore: init repo with license, gitignore, docs"
```

---

## Task 2: ATT&CK data — fetch + trim script

**Files:**
- Create: `scripts/fetch-attack-data.js`
- Create: `app/src/data/attack-enterprise.json` (output — committed)

- [ ] **Step 1: Create `scripts/fetch-attack-data.js`**

```js
#!/usr/bin/env node
// Downloads MITRE ATT&CK Enterprise STIX v16.1 and trims to tactics + techniques.
// Run once: node scripts/fetch-attack-data.js
// Output committed as app/src/data/attack-enterprise.json

const https = require('https');
const fs = require('fs');
const path = require('path');

const STIX_URL =
  'https://raw.githubusercontent.com/mitre-attack/attack-stix-data/master/enterprise-attack/enterprise-attack-16.1.json';
const OUT = path.join(__dirname, '../app/src/data/attack-enterprise.json');

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve(JSON.parse(data)));
      res.on('error', reject);
    });
  });
}

async function main() {
  console.log('Downloading ATT&CK STIX data (~8 MB)...');
  const bundle = await fetchJSON(STIX_URL);

  const objects = bundle.objects;

  // Extract x-mitre-tactic objects (order by x_mitre_shortname index)
  const tacticOrder = [
    'reconnaissance', 'resource-development', 'initial-access', 'execution',
    'persistence', 'privilege-escalation', 'defense-evasion', 'credential-access',
    'discovery', 'lateral-movement', 'collection', 'command-and-control',
    'exfiltration', 'impact',
  ];

  const tacticObjs = {};
  objects
    .filter((o) => o.type === 'x-mitre-tactic')
    .forEach((t) => {
      tacticObjs[t.x_mitre_shortname] = {
        id: t.external_references.find((r) => r.source_name === 'mitre-attack').external_id,
        name: t.name,
        shortname: t.x_mitre_shortname,
        techniques: [],
      };
    });

  // Build technique lookup: stix-id → {id, name, sub_techniques: []}
  const techniqueMap = {};
  objects
    .filter(
      (o) =>
        o.type === 'attack-pattern' &&
        !o.x_mitre_deprecated &&
        !o.revoked &&
        !o.x_mitre_is_subtechnique
    )
    .forEach((t) => {
      const extId = t.external_references.find((r) => r.source_name === 'mitre-attack').external_id;
      techniqueMap[t.id] = { id: extId, name: t.name, sub_techniques: [] };
    });

  // Sub-techniques
  objects
    .filter(
      (o) =>
        o.type === 'attack-pattern' &&
        !o.x_mitre_deprecated &&
        !o.revoked &&
        o.x_mitre_is_subtechnique
    )
    .forEach((sub) => {
      const extId = sub.external_references.find((r) => r.source_name === 'mitre-attack').external_id;
      // parent id from extId e.g. T1595.001 → T1595
      const parentId = extId.split('.')[0];
      const parentStixId = Object.keys(techniqueMap).find(
        (k) => techniqueMap[k].id === parentId
      );
      if (parentStixId) {
        techniqueMap[parentStixId].sub_techniques.push({ id: extId, name: sub.name });
      }
    });

  // Map techniques to tactics via kill_chain_phases
  Object.values(techniqueMap).forEach((tech) => {
    const obj = objects.find((o) => o.type === 'attack-pattern' && !o.x_mitre_is_subtechnique &&
      o.external_references?.find((r) => r.source_name === 'mitre-attack' && r.external_id === tech.id));
    if (!obj) return;
    (obj.kill_chain_phases || []).forEach((phase) => {
      if (tacticObjs[phase.phase_name]) {
        // Sort sub-techniques
        tech.sub_techniques.sort((a, b) => a.id.localeCompare(b.id));
        tacticObjs[phase.phase_name].techniques.push(tech);
      }
    });
  });

  // Sort techniques within each tactic by ID
  Object.values(tacticObjs).forEach((t) => {
    t.techniques.sort((a, b) => a.id.localeCompare(b.id));
  });

  const output = {
    version: '16.1',
    tactics: tacticOrder.map((s) => tacticObjs[s]).filter(Boolean),
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(output, null, 2));
  console.log(`Done. Written to ${OUT}`);
  console.log(`Tactics: ${output.tactics.length}`);
  console.log(`Techniques: ${output.tactics.reduce((s, t) => s + t.techniques.length, 0)}`);
}

main().catch(console.error);
```

- [ ] **Step 2: Create `app/src/data/` directory and run the script**

```bash
mkdir -p app/src/data
node scripts/fetch-attack-data.js
```

Expected output:
```
Downloading ATT&CK STIX data (~8 MB)...
Done. Written to .../app/src/data/attack-enterprise.json
Tactics: 14
Techniques: 196
```

- [ ] **Step 3: Verify output**

```bash
node -e "
const d = require('./app/src/data/attack-enterprise.json');
console.log('Tactics:', d.tactics.map(t => t.id + ' ' + t.name));
console.log('First tactic techniques:', d.tactics[0].techniques.slice(0,3).map(t=>t.id+' '+t.name));
"
```

Expected: 14 tactics listed starting with TA0043 Reconnaissance.

- [ ] **Step 4: Commit**

```bash
git add scripts/fetch-attack-data.js app/src/data/attack-enterprise.json
git commit -m "feat: add MITRE ATT&CK Enterprise v16.1 trimmed data"
```

---

## Task 3: app/ — Vite + React + TypeScript scaffold

**Files:**
- Create: `app/package.json`
- Create: `app/index.html`
- Create: `app/vite.config.ts`
- Create: `app/tsconfig.json`
- Create: `app/src/main.tsx`

- [ ] **Step 1: Scaffold app/ with Vite**

```bash
cd /Users/jelyf1shhhhhh/Documents/code/red-team-ai-agent-summary
npm create vite@latest app -- --template react-ts
```

When prompted, confirm overwrite of existing `app/` directory (only `src/data/` exists there).

- [ ] **Step 2: Install dependencies**

```bash
cd app && npm install && cd ..
```

- [ ] **Step 3: Add Vitest**

```bash
cd app && npm install -D vitest @vitest/ui @testing-library/react @testing-library/jest-dom jsdom && cd ..
```

- [ ] **Step 4: Update `app/vite.config.ts`**

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test-setup.ts',
  },
})
```

- [ ] **Step 5: Create `app/src/test-setup.ts`**

```ts
import '@testing-library/jest-dom'
```

- [ ] **Step 6: Delete Vite boilerplate**

```bash
rm -f app/src/App.css app/src/assets/react.svg public/vite.svg
```

- [ ] **Step 7: Clear `app/src/main.tsx` to minimal**

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 8: Create placeholder `app/src/App.tsx`**

```tsx
export default function App() {
  return <div>Loading...</div>
}
```

- [ ] **Step 9: Verify dev server starts**

```bash
cd app && npm run dev
```

Expected: Vite dev server at http://localhost:5173, page shows "Loading..."

- [ ] **Step 10: Commit**

```bash
cd /Users/jelyf1shhhhhh/Documents/code/red-team-ai-agent-summary
git add app/
git commit -m "feat: scaffold app/ with vite+react+ts"
```

---

## Task 4: TypeScript types

**Files:**
- Create: `app/src/types/index.ts`

- [ ] **Step 1: Write `app/src/types/index.ts`**

```ts
export interface SubTechnique {
  id: string   // e.g. "T1595.001"
  name: string
}

export interface Technique {
  id: string              // e.g. "T1595"
  name: string
  sub_techniques: SubTechnique[]
}

export interface Tactic {
  id: string              // e.g. "TA0043"
  name: string
  shortname: string       // e.g. "reconnaissance"
  techniques: Technique[]
}

export interface AttackData {
  version: string
  tactics: Tactic[]
}

export interface TechniqueMapping {
  id: string              // technique or sub-technique ID, e.g. "T1595" or "T1595.001"
  notes: string
}

export interface Paper {
  title: string
  venue: string
  year: number
  authors: string[]
  arxiv?: string
  url: string
  affiliation: string
  summary: string
  tags: string[]
}

export interface Agent {
  id: string              // kebab-case slug, e.g. "artemis"
  name: string            // display name
  paper: Paper
  techniques: TechniqueMapping[]
}

export interface PapersData {
  version: string
  lastUpdated: string
  agents: Agent[]
}

// Derived types for UI

export interface OverviewCell {
  agentId: string
  tacticId: string
  count: number           // techniques covered in this tactic
}
```

- [ ] **Step 2: Commit**

```bash
git add app/src/types/
git commit -m "feat: add TypeScript types for ATT&CK + papers data"
```

---

## Task 5: Utility functions + tests

**Files:**
- Create: `app/src/utils/attack.ts`
- Create: `app/src/utils/attack.test.ts`

- [ ] **Step 1: Write failing tests first — `app/src/utils/attack.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { isCovered, getCoveredIds, buildOverviewMatrix } from './attack'
import type { Agent, Tactic } from '../types'

const mockAgent: Agent = {
  id: 'test-agent',
  name: 'Test',
  paper: { title: '', venue: '', year: 2025, authors: [], url: '', affiliation: '', summary: '', tags: [] },
  techniques: [
    { id: 'T1595', notes: '' },
    { id: 'T1595.001', notes: '' },
    { id: 'T1046', notes: '' },
  ],
}

const mockTactic: Tactic = {
  id: 'TA0043',
  name: 'Reconnaissance',
  shortname: 'reconnaissance',
  techniques: [
    {
      id: 'T1595', name: 'Active Scanning',
      sub_techniques: [
        { id: 'T1595.001', name: 'Scanning IP Blocks' },
        { id: 'T1595.002', name: 'Vulnerability Scanning' },
      ],
    },
    { id: 'T1592', name: 'Gather Host Info', sub_techniques: [] },
  ],
}

describe('isCovered', () => {
  it('returns true for covered technique', () => {
    expect(isCovered(mockAgent, 'T1595')).toBe(true)
  })
  it('returns true for covered sub-technique', () => {
    expect(isCovered(mockAgent, 'T1595.001')).toBe(true)
  })
  it('returns false for uncovered technique', () => {
    expect(isCovered(mockAgent, 'T1592')).toBe(false)
  })
  it('returns false for uncovered sub-technique', () => {
    expect(isCovered(mockAgent, 'T1595.002')).toBe(false)
  })
})

describe('getCoveredIds', () => {
  it('returns set of all covered IDs', () => {
    const ids = getCoveredIds(mockAgent)
    expect(ids.has('T1595')).toBe(true)
    expect(ids.has('T1595.001')).toBe(true)
    expect(ids.has('T1046')).toBe(true)
    expect(ids.has('T1592')).toBe(false)
  })
})

describe('buildOverviewMatrix', () => {
  it('returns correct count for agent + tactic', () => {
    const matrix = buildOverviewMatrix([mockAgent], [mockTactic])
    const cell = matrix.find((c) => c.agentId === 'test-agent' && c.tacticId === 'TA0043')
    // T1595 is covered (1 technique in TA0043)
    expect(cell?.count).toBe(1)
  })
  it('returns 0 when no techniques covered in tactic', () => {
    const agentNone: Agent = { ...mockAgent, techniques: [] }
    const matrix = buildOverviewMatrix([agentNone], [mockTactic])
    const cell = matrix.find((c) => c.agentId === 'test-agent' && c.tacticId === 'TA0043')
    expect(cell?.count).toBe(0)
  })
})
```

- [ ] **Step 2: Run tests — expect failure**

```bash
cd app && npx vitest run src/utils/attack.test.ts 2>&1 | tail -5
```

Expected: error about missing module `./attack`.

- [ ] **Step 3: Write `app/src/utils/attack.ts`**

```ts
import type { Agent, Tactic, OverviewCell } from '../types'

export function isCovered(agent: Agent, techniqueId: string): boolean {
  return agent.techniques.some((t) => t.id === techniqueId)
}

export function getCoveredIds(agent: Agent): Set<string> {
  return new Set(agent.techniques.map((t) => t.id))
}

/** Count how many top-level techniques (not sub-techniques) in a tactic are covered. */
export function countCoveredInTactic(agent: Agent, tactic: Tactic): number {
  const covered = getCoveredIds(agent)
  return tactic.techniques.filter((t) => covered.has(t.id)).length
}

export function buildOverviewMatrix(agents: Agent[], tactics: Tactic[]): OverviewCell[] {
  const cells: OverviewCell[] = []
  for (const agent of agents) {
    for (const tactic of tactics) {
      cells.push({
        agentId: agent.id,
        tacticId: tactic.id,
        count: countCoveredInTactic(agent, tactic),
      })
    }
  }
  return cells
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd app && npx vitest run src/utils/attack.test.ts
```

Expected: all 7 tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/jelyf1shhhhhh/Documents/code/red-team-ai-agent-summary
git add app/src/utils/
git commit -m "feat: add ATT&CK utility functions with tests"
```

---

## Task 6: `papers.json` — initial data population

**Files:**
- Create: `app/public/papers.json`

- [ ] **Step 1: Create `app/public/papers.json`**

Write the following JSON (best-effort technique mappings from Obsidian notes — use editor in Task 17 to refine):

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
        "summary": "在真實大學企業網路（~8000 hosts, 12 子網路）的競賽性紅隊評測中，ARTEMIS A1（GPT-5 supervisor + 動態子 agents + Triage Module）以 9 個有效漏洞排名第 2（僅次於最強人類），成本 $18.21/hr，首次在企業規模展示 multi-agent 超越大多數人類紅隊員。",
        "tags": ["multi-agent", "enterprise", "GPT-5", "supervisor"]
      },
      "techniques": [
        {"id": "T1595", "notes": "Uses dynamic sub-agents to perform active network scanning"},
        {"id": "T1595.001", "notes": "Scans IP blocks across 12 subnets"},
        {"id": "T1595.002", "notes": "Automated vulnerability scanning per host"},
        {"id": "T1592", "notes": "Gathers host info during reconnaissance phase"},
        {"id": "T1590", "notes": "Maps network topology across 8000 hosts"},
        {"id": "T1046", "notes": "Network service discovery via sub-agents"},
        {"id": "T1082", "notes": "System information discovery"},
        {"id": "T1018", "notes": "Remote system discovery across subnets"},
        {"id": "T1190", "notes": "Exploits public-facing applications identified in recon"},
        {"id": "T1133", "notes": "Targets external remote services"},
        {"id": "T1021", "notes": "Uses remote services for lateral movement"},
        {"id": "T1021.001", "notes": "RDP-based lateral movement"},
        {"id": "T1068", "notes": "Exploitation for privilege escalation"}
      ]
    },
    {
      "id": "cai",
      "name": "CAI",
      "paper": {
        "title": "CAI: Cybersecurity AI Framework",
        "venue": "arXiv (multi-paper)",
        "year": 2025,
        "authors": ["Alias Robotics"],
        "arxiv": "2504.06017",
        "url": "https://github.com/aliasrobotics/cai",
        "affiliation": "Alias Robotics (Spain)",
        "summary": "開源輕量 AI 驅動資安自動化框架，支援 300+ 模型、內建安全工具、模組化 agent 架構，已在 HackTheBox、Bug Bounty、OT/ICS 真實場景驗證。Full kill chain 覆蓋 Recon → Exploitation → PrivEsc → C2。",
        "tags": ["framework", "open-source", "300+ models", "full kill chain", "OT/ICS"]
      },
      "techniques": [
        {"id": "T1595", "notes": "Built-in recon tools"},
        {"id": "T1595.002", "notes": "Vulnerability scanning module"},
        {"id": "T1592", "notes": "Host info gathering"},
        {"id": "T1590", "notes": "Network topology discovery"},
        {"id": "T1190", "notes": "Exploit public-facing applications"},
        {"id": "T1133", "notes": "External remote services exploitation"},
        {"id": "T1078", "notes": "Valid accounts credential use"},
        {"id": "T1059", "notes": "Command and scripting interpreter execution"},
        {"id": "T1059.001", "notes": "PowerShell execution"},
        {"id": "T1059.004", "notes": "Unix shell execution"},
        {"id": "T1053", "notes": "Scheduled task/job persistence"},
        {"id": "T1098", "notes": "Account manipulation"},
        {"id": "T1068", "notes": "Exploitation for privilege escalation"},
        {"id": "T1548", "notes": "Abuse elevation control mechanism"},
        {"id": "T1027", "notes": "Obfuscated files and information"},
        {"id": "T1055", "notes": "Process injection"},
        {"id": "T1562", "notes": "Impair defenses"},
        {"id": "T1110", "notes": "Brute force credential access"},
        {"id": "T1003", "notes": "OS credential dumping"},
        {"id": "T1046", "notes": "Network service discovery"},
        {"id": "T1082", "notes": "System information discovery"},
        {"id": "T1018", "notes": "Remote system discovery"},
        {"id": "T1083", "notes": "File and directory discovery"},
        {"id": "T1069", "notes": "Permission groups discovery"},
        {"id": "T1021", "notes": "Remote services lateral movement"},
        {"id": "T1021.001", "notes": "RDP"},
        {"id": "T1021.002", "notes": "SMB/Windows Admin Shares"},
        {"id": "T1021.004", "notes": "SSH"},
        {"id": "T1071", "notes": "Application layer protocol C2"},
        {"id": "T1095", "notes": "Non-application layer protocol C2"},
        {"id": "T1105", "notes": "Ingress tool transfer"}
      ]
    },
    {
      "id": "decepticon",
      "name": "Decepticon",
      "paper": {
        "title": "Decepticon: Autonomous Red Team Agent",
        "venue": "GitHub / Production Tool",
        "year": 2026,
        "authors": ["PurpleAILAB"],
        "arxiv": "",
        "url": "https://github.com/PurpleAILAB/Decepticon",
        "affiliation": "PurpleAILAB",
        "summary": "16 個專家 agent 組成的自主紅隊系統，以 engagement discipline（RoE + OPPLAN）為核心，每個 agent 新建 context window 避免噪音累積；XBOW Hard Level 3 benchmark 達 7/8（87.5%）。支援 msfconsole、sliver-client、evil-winrm 等互動式 shell。",
        "tags": ["multi-agent", "production", "LangGraph", "XBOW 87.5%", "full kill chain"]
      },
      "techniques": [
        {"id": "T1595", "notes": "Recon agent performs active scanning"},
        {"id": "T1592", "notes": "Host info gathering"},
        {"id": "T1590", "notes": "Network info gathering"},
        {"id": "T1190", "notes": "Exploit agent targets public-facing apps"},
        {"id": "T1133", "notes": "External remote services"},
        {"id": "T1059", "notes": "Command execution in Kali sandbox"},
        {"id": "T1059.004", "notes": "Bash/shell execution"},
        {"id": "T1053", "notes": "Scheduled task persistence"},
        {"id": "T1098", "notes": "Account manipulation"},
        {"id": "T1505", "notes": "Server software component (web shells)"},
        {"id": "T1068", "notes": "Exploitation for PrivEsc via Metasploit"},
        {"id": "T1548", "notes": "Elevation control mechanism abuse"},
        {"id": "T1134", "notes": "Access token manipulation"},
        {"id": "T1027", "notes": "Obfuscation for defense evasion"},
        {"id": "T1562", "notes": "Impair defenses"},
        {"id": "T1110", "notes": "Brute force via built-in tools"},
        {"id": "T1003", "notes": "Credential dumping"},
        {"id": "T1046", "notes": "Network service discovery"},
        {"id": "T1082", "notes": "System info discovery"},
        {"id": "T1018", "notes": "Remote system discovery"},
        {"id": "T1021", "notes": "Lateral movement via remote services"},
        {"id": "T1021.001", "notes": "RDP lateral movement"},
        {"id": "T1021.002", "notes": "SMB lateral movement"},
        {"id": "T1021.004", "notes": "SSH via evil-winrm equivalent"},
        {"id": "T1071", "notes": "C2 via application layer protocol"},
        {"id": "T1095", "notes": "C2 via non-application layer"},
        {"id": "T1105", "notes": "Tool transfer to target"}
      ]
    },
    {
      "id": "hacksynth",
      "name": "HackSynth",
      "paper": {
        "title": "HackSynth: LLM Agent and Evaluation Framework for Autonomous Penetration Testing",
        "venue": "arXiv 2024",
        "year": 2024,
        "authors": ["Lajos Muzsai", "David Imolai", "András Lukács"],
        "arxiv": "2412.01778",
        "url": "https://arxiv.org/abs/2412.01778",
        "affiliation": "Eötvös Loránd University",
        "summary": "單 agent 雙模組（Planner + Summarizer）架構，在自建 CTF benchmark 上 GPT-4o 達 PicoCTF 34.2%、OverTheWire 40%；同時提供 200 題的公開 CTF benchmark。最多 20 步循環：Planner 生成 bash 指令 → 執行 → Summarizer 壓縮歷史。",
        "tags": ["single-agent", "CTF", "Planner-Summarizer", "GPT-4o", "benchmark"]
      },
      "techniques": [
        {"id": "T1595", "notes": "Active scanning in CTF challenges"},
        {"id": "T1592", "notes": "Host info gathering"},
        {"id": "T1190", "notes": "Exploiting public-facing services in CTF"},
        {"id": "T1059", "notes": "Shell command execution (primary action method)"},
        {"id": "T1059.004", "notes": "Unix shell via bash commands"},
        {"id": "T1046", "notes": "Port scanning with nmap"},
        {"id": "T1082", "notes": "System information gathering"},
        {"id": "T1083", "notes": "File and directory discovery"}
      ]
    },
    {
      "id": "red-mirror",
      "name": "Red-MIRROR",
      "paper": {
        "title": "Red-MIRROR: Agentic LLM-based Autonomous Penetration Testing with Reflective Verification and Knowledge-augmented Interaction",
        "venue": "arXiv 2026",
        "year": 2026,
        "authors": ["Tran Vy Khang", "Nguyen Dang Nguyen Khang", "Nghi Hoang Khoa", "Do Thi Thu Hien", "Van-Hau Pham", "Phan The Duy"],
        "arxiv": "2603.27127",
        "url": "https://arxiv.org/abs/2603.27127",
        "affiliation": "University research group",
        "summary": "6 個 agent 分工的 Web 滲透系統（Recon→VulnDisc→Exploit→PrivEsc→PostExploit→Report），靠 Shared Recurrent Memory + Dual-Phase Reflection + RAG 三件套，在 XBOW benchmark 達到 86% 成功率。VulnBot（多 agent 無機制）= 6%，說明機制設計比 agent 數量重要。",
        "tags": ["web-pentest", "multi-agent", "LangGraph", "RAG", "XBOW 86%", "reflection"]
      },
      "techniques": [
        {"id": "T1595", "notes": "Reconnaissance agent: port scan, tech stack detection"},
        {"id": "T1592", "notes": "Host info gathering"},
        {"id": "T1596", "notes": "Search open technical databases for vuln info"},
        {"id": "T1190", "notes": "Exploitation agent: web app vulnerability exploitation (SQLi, XSS, SSRF, path traversal)"},
        {"id": "T1189", "notes": "Drive-by compromise (web-based attack vectors)"},
        {"id": "T1059", "notes": "Command execution post-exploitation"},
        {"id": "T1548", "notes": "Privilege escalation agent"},
        {"id": "T1068", "notes": "Exploitation for privilege escalation"},
        {"id": "T1046", "notes": "Service discovery"},
        {"id": "T1082", "notes": "System information via post-exploit agent"},
        {"id": "T1083", "notes": "File and directory discovery"}
      ]
    },
    {
      "id": "pentest-agent",
      "name": "PentestAgent",
      "paper": {
        "title": "PentestAgent: Incorporating LLM Agents to Automated Penetration Testing",
        "venue": "ASIA CCS 2025",
        "year": 2025,
        "authors": ["et al."],
        "arxiv": "",
        "url": "",
        "affiliation": "",
        "summary": "首個結合 LLM 多代理、多階段自動化滲透測試的系統，覆蓋情報蒐集、漏洞分析、攻擊利用三大流程。專職 agent 協同：reconnaissance agent、search agent、planning agent、execution agent。使用 RAG 整合外部知識，搭配 CoT 和 role-playing prompt engineering。",
        "tags": ["multi-agent", "multi-stage", "RAG", "CoT", "ASIA CCS 2025"]
      },
      "techniques": [
        {"id": "T1595", "notes": "Reconnaissance agent performs active scanning"},
        {"id": "T1592", "notes": "Host information gathering"},
        {"id": "T1590", "notes": "Network information discovery"},
        {"id": "T1596", "notes": "Search agent queries technical databases"},
        {"id": "T1190", "notes": "Execution agent exploits public-facing apps"},
        {"id": "T1133", "notes": "External remote service exploitation"},
        {"id": "T1059", "notes": "Command execution via execution agent"},
        {"id": "T1046", "notes": "Network service discovery"},
        {"id": "T1082", "notes": "System information discovery"},
        {"id": "T1083", "notes": "File and directory discovery"},
        {"id": "T1018", "notes": "Remote system discovery"},
        {"id": "T1068", "notes": "Exploitation for privilege escalation"}
      ]
    },
    {
      "id": "pentest-r1",
      "name": "Pentest-R1",
      "paper": {
        "title": "Pentest-R1: Towards Autonomous Penetration Testing Reasoning Optimized via Two-Stage Reinforcement Learning",
        "venue": "arXiv 2025",
        "year": 2025,
        "authors": ["et al."],
        "arxiv": "",
        "url": "",
        "affiliation": "",
        "summary": "用兩階段強化學習（Two-Stage RL）優化 LLM 在滲透測試中的推理與決策路徑。Stage 1 訓練基礎滲透測試推理能力，Stage 2 優化決策鏈在真實場景的泛化。強調自主推理而非固定流程。",
        "tags": ["RL", "two-stage", "reasoning", "autonomous"]
      },
      "techniques": [
        {"id": "T1595", "notes": "Reconnaissance via RL-guided scanning"},
        {"id": "T1592", "notes": "Host info gathering"},
        {"id": "T1190", "notes": "Exploit public-facing application"},
        {"id": "T1059", "notes": "Command execution"},
        {"id": "T1059.004", "notes": "Shell command execution"},
        {"id": "T1046", "notes": "Network service discovery"},
        {"id": "T1082", "notes": "System info discovery"}
      ]
    },
    {
      "id": "llms-hack-en",
      "name": "LLMs-Hack-EN",
      "paper": {
        "title": "Can LLMs Hack Enterprise Networks? Autonomous Assumed Breach Penetration Testing against Enterprise Networks",
        "venue": "ACM 2025",
        "year": 2025,
        "authors": ["et al."],
        "arxiv": "",
        "url": "",
        "affiliation": "",
        "summary": "針對企業網路 assumed-breach 場景（已獲初始立足點）做自主滲透測試評估。與 ARTEMIS 並列，是目前最稀缺的真實企業環境評估。測試 LLM 在已進入網路後的橫向移動、提權、憑證竊取能力。",
        "tags": ["assumed-breach", "enterprise", "lateral-movement", "ACM 2025"]
      },
      "techniques": [
        {"id": "T1068", "notes": "Exploitation for privilege escalation (primary focus)"},
        {"id": "T1548", "notes": "Abuse elevation control mechanism"},
        {"id": "T1134", "notes": "Access token manipulation"},
        {"id": "T1110", "notes": "Brute force credential access"},
        {"id": "T1003", "notes": "OS credential dumping"},
        {"id": "T1558", "notes": "Steal or forge Kerberos tickets"},
        {"id": "T1046", "notes": "Internal network service discovery"},
        {"id": "T1082", "notes": "System information discovery"},
        {"id": "T1018", "notes": "Remote system discovery"},
        {"id": "T1069", "notes": "Permission groups discovery (AD)"},
        {"id": "T1087", "notes": "Account discovery"},
        {"id": "T1021", "notes": "Remote services lateral movement"},
        {"id": "T1021.001", "notes": "RDP lateral movement"},
        {"id": "T1021.002", "notes": "SMB lateral movement"}
      ]
    },
    {
      "id": "autopen",
      "name": "AutoPen",
      "paper": {
        "title": "AutoPen: Towards Autonomous Penetration Testing Using LLMs",
        "venue": "ACM 2025",
        "year": 2025,
        "authors": ["et al."],
        "arxiv": "",
        "url": "",
        "affiliation": "",
        "summary": "探討用 LLM 進行自主滲透測試的方法論與挑戰；ACM 發表，定位是自主滲透測試的綜合研究。",
        "tags": ["autonomous", "LLM", "methodology", "ACM 2025"]
      },
      "techniques": [
        {"id": "T1595", "notes": "Active scanning"},
        {"id": "T1592", "notes": "Host information gathering"},
        {"id": "T1190", "notes": "Exploit public-facing application"},
        {"id": "T1059", "notes": "Command execution"},
        {"id": "T1046", "notes": "Network service discovery"},
        {"id": "T1082", "notes": "System information discovery"}
      ]
    }
  ]
}
```

- [ ] **Step 2: Verify JSON is valid**

```bash
node -e "const d = require('./app/public/papers.json'); console.log('Agents:', d.agents.map(a=>a.id))"
```

Expected: list of 9 agent IDs.

- [ ] **Step 3: Commit**

```bash
git add app/public/papers.json
git commit -m "feat: add initial papers.json with 9 red-team AI agents and ATT&CK mappings"
```

---

## Task 7: `useData` hook + App skeleton

**Files:**
- Create: `app/src/hooks/useData.ts`
- Modify: `app/src/App.tsx`

- [ ] **Step 1: Create `app/src/hooks/useData.ts`**

```ts
import { useState, useEffect } from 'react'
import attackRaw from '../data/attack-enterprise.json'
import type { AttackData, PapersData } from '../types'

interface DataState {
  papers: PapersData | null
  attack: AttackData
  loading: boolean
  error: string | null
}

export function useData(): DataState {
  const [papers, setPapers] = useState<PapersData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/papers.json')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<PapersData>
      })
      .then((data) => {
        setPapers(data)
        setLoading(false)
      })
      .catch((e: Error) => {
        setError(e.message)
        setLoading(false)
      })
  }, [])

  return { papers, attack: attackRaw as AttackData, loading, error }
}
```

- [ ] **Step 2: Update `app/src/App.tsx`**

```tsx
import { useState } from 'react'
import { useData } from './hooks/useData'
import { AgentTabs } from './components/AgentTabs'
import { TacticSection } from './components/TacticSection'
import { PaperSidebar } from './components/PaperSidebar'
import { OverviewMatrix } from './components/OverviewMatrix'
import type { Agent } from './types'

export default function App() {
  const { papers, attack, loading, error } = useData()
  const [selectedAgentId, setSelectedAgentId] = useState<string | 'overview'>('overview')

  if (loading) return <div className="app-loading">Loading ATT&amp;CK data...</div>
  if (error || !papers) return <div className="app-error">Error: {error ?? 'No data'}</div>

  const selectedAgent: Agent | undefined =
    selectedAgentId !== 'overview'
      ? papers.agents.find((a) => a.id === selectedAgentId)
      : undefined

  return (
    <div className="app">
      <header className="topbar">
        <span className="topbar-logo">RedTeam AI <span className="topbar-logo-sub">× MITRE ATT&amp;CK Enterprise</span></span>
      </header>

      <AgentTabs
        agents={papers.agents}
        selectedId={selectedAgentId}
        onSelect={setSelectedAgentId}
      />

      <div className="main-body">
        {selectedAgentId === 'overview' ? (
          <OverviewMatrix
            agents={papers.agents}
            tactics={attack.tactics}
            onSelectAgent={setSelectedAgentId}
          />
        ) : selectedAgent ? (
          <>
            <div className="technique-panel">
              {attack.tactics.map((tactic) => (
                <TacticSection key={tactic.id} tactic={tactic} agent={selectedAgent} />
              ))}
            </div>
            <PaperSidebar agent={selectedAgent} attack={attack} />
          </>
        ) : null}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create stub components so app compiles**

Create `app/src/components/AgentTabs.tsx`:
```tsx
import type { Agent } from '../types'
interface Props { agents: Agent[]; selectedId: string; onSelect: (id: string) => void }
export function AgentTabs({ agents, selectedId, onSelect }: Props) {
  return <div className="agent-tabs">
    <button className={`agent-tab${selectedId === 'overview' ? ' active overview' : ''}`} onClick={() => onSelect('overview')}>Overview</button>
    {agents.map(a => <button key={a.id} className={`agent-tab${selectedId === a.id ? ' active' : ''}`} onClick={() => onSelect(a.id)}>{a.name}</button>)}
  </div>
}
```

Create `app/src/components/TacticSection.tsx`:
```tsx
import type { Tactic, Agent } from '../types'
interface Props { tactic: Tactic; agent: Agent }
export function TacticSection({ tactic }: Props) { return <div>{tactic.name}</div> }
```

Create `app/src/components/PaperSidebar.tsx`:
```tsx
import type { Agent, AttackData } from '../types'
interface Props { agent: Agent; attack: AttackData }
export function PaperSidebar({ agent }: Props) { return <div>{agent.name}</div> }
```

Create `app/src/components/OverviewMatrix.tsx`:
```tsx
import type { Agent, Tactic } from '../types'
interface Props { agents: Agent[]; tactics: Tactic[]; onSelectAgent: (id: string) => void }
export function OverviewMatrix({ agents }: Props) { return <div>{agents.length} agents</div> }
```

- [ ] **Step 4: Verify app compiles**

```bash
cd app && npm run build 2>&1 | tail -10
```

Expected: successful build with no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/jelyf1shhhhhh/Documents/code/red-team-ai-agent-summary
git add app/src/
git commit -m "feat: add useData hook and App skeleton with stub components"
```

---

## Task 8: `AgentTabs` component (final)

**Files:**
- Modify: `app/src/components/AgentTabs.tsx`

- [ ] **Step 1: Replace stub with full implementation**

```tsx
import type { Agent } from '../types'

interface Props {
  agents: Agent[]
  selectedId: string
  onSelect: (id: string) => void
}

export function AgentTabs({ agents, selectedId, onSelect }: Props) {
  return (
    <nav className="agent-tabs" role="tablist" aria-label="Agent selection">
      <button
        role="tab"
        aria-selected={selectedId === 'overview'}
        className={`agent-tab overview${selectedId === 'overview' ? ' active' : ''}`}
        onClick={() => onSelect('overview')}
      >
        Overview
      </button>
      {agents.map((agent) => (
        <button
          key={agent.id}
          role="tab"
          aria-selected={selectedId === agent.id}
          className={`agent-tab${selectedId === agent.id ? ' active' : ''}`}
          onClick={() => onSelect(agent.id)}
        >
          {agent.name}
        </button>
      ))}
    </nav>
  )
}
```

- [ ] **Step 2: Verify in browser — http://localhost:5173 should show all agent tabs scrollable**

- [ ] **Step 3: Commit**

```bash
git add app/src/components/AgentTabs.tsx
git commit -m "feat: implement AgentTabs component"
```

---

## Task 9: `TacticSection` + `TechniqueRow` components

**Files:**
- Modify: `app/src/components/TacticSection.tsx`
- Create: `app/src/components/TechniqueRow.tsx`

- [ ] **Step 1: Create `app/src/components/TechniqueRow.tsx`**

```tsx
import { isCovered } from '../utils/attack'
import type { Technique, Agent } from '../types'

interface Props {
  technique: Technique
  agent: Agent
}

export function TechniqueRow({ technique, agent }: Props) {
  const covered = isCovered(agent, technique.id)
  const coveredNote = covered
    ? agent.techniques.find((t) => t.id === technique.id)?.notes
    : undefined

  return (
    <div className={`technique-row${covered ? ' covered' : ''}`}>
      <span className="tid">{technique.id}</span>
      <span className="tname">{technique.name}</span>
      {covered && <span className="covered-dot" title={coveredNote || 'Covered'} />}

      {technique.sub_techniques.length > 0 && (
        <div className="sub-list">
          {technique.sub_techniques.map((sub) => {
            const subCovered = isCovered(agent, sub.id)
            const subNote = subCovered
              ? agent.techniques.find((t) => t.id === sub.id)?.notes
              : undefined
            return (
              <div key={sub.id} className={`sub-row${subCovered ? ' covered' : ''}`}>
                <span className="tid">{sub.id}</span>
                <span className="tname">{sub.name}</span>
                {subCovered && <span className="covered-dot" title={subNote || 'Covered'} />}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Update `app/src/components/TacticSection.tsx`**

```tsx
import { useState } from 'react'
import { countCoveredInTactic } from '../utils/attack'
import { TechniqueRow } from './TechniqueRow'
import type { Tactic, Agent } from '../types'

interface Props {
  tactic: Tactic
  agent: Agent
}

export function TacticSection({ tactic, agent }: Props) {
  const [open, setOpen] = useState(true)
  const coveredCount = countCoveredInTactic(agent, tactic)

  return (
    <div className="tactic-section">
      <button
        className="tactic-header"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="tactic-id">{tactic.id}</span>
        <span className="tactic-name">{tactic.name}</span>
        <span
          className={`tactic-badge${coveredCount === 0 ? ' zero' : ''}`}
        >
          {coveredCount} covered
        </span>
        <span className="tactic-chevron">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="technique-list">
          {tactic.techniques.map((tech) => (
            <TechniqueRow key={tech.id} technique={tech} agent={agent} />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify in browser — ARTEMIS tab should show green-highlighted techniques**

- [ ] **Step 4: Commit**

```bash
git add app/src/components/TacticSection.tsx app/src/components/TechniqueRow.tsx
git commit -m "feat: implement TacticSection and TechniqueRow with coverage highlighting"
```

---

## Task 10: `PaperSidebar` component

**Files:**
- Modify: `app/src/components/PaperSidebar.tsx`

- [ ] **Step 1: Replace stub with full implementation**

```tsx
import { getCoveredIds } from '../utils/attack'
import type { Agent, AttackData } from '../types'

interface Props {
  agent: Agent
  attack: AttackData
}

export function PaperSidebar({ agent, attack }: Props) {
  const covered = getCoveredIds(agent)

  const coveredTactics = attack.tactics.filter((tactic) =>
    tactic.techniques.some((t) => covered.has(t.id))
  )

  const totalTechniqueCount = agent.techniques.length

  return (
    <aside className="paper-sidebar">
      <div className="sidebar-title">Paper Info</div>

      <div className="paper-card">
        <h3 className="paper-title">{agent.paper.title}</h3>
        <div className="paper-venue">{agent.paper.venue} · {agent.paper.affiliation}</div>
        <div className="paper-meta">
          {agent.paper.authors.join(', ')}<br />
          {agent.paper.year}
          {agent.paper.arxiv && (
            <> · <a href={`https://arxiv.org/abs/${agent.paper.arxiv}`} target="_blank" rel="noreferrer" className="paper-link">arXiv:{agent.paper.arxiv}</a></>
          )}
        </div>
        <div className="paper-tags">
          {agent.paper.tags.map((tag) => (
            <span key={tag} className="tag">{tag}</span>
          ))}
        </div>
        <p className="paper-summary">{agent.paper.summary}</p>
      </div>

      <div className="sidebar-section-title">ATT&amp;CK Coverage</div>
      <div className="coverage-stats">
        <div className="stat-box">
          <div className="stat-num">{totalTechniqueCount}</div>
          <div className="stat-label">Techniques</div>
        </div>
        <div className="stat-box">
          <div className="stat-num">{coveredTactics.length}</div>
          <div className="stat-label">Tactics</div>
        </div>
      </div>

      <div className="sidebar-section-title">Covered Tactics</div>
      <div className="covered-tactics-list">
        {coveredTactics.map((t) => (
          <div key={t.id} className="covered-tactic-item">
            <span className="tactic-id-small">{t.id}</span>
            <span>{t.name}</span>
          </div>
        ))}
      </div>
    </aside>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/src/components/PaperSidebar.tsx
git commit -m "feat: implement PaperSidebar with paper info and ATT&CK coverage stats"
```

---

## Task 11: `OverviewMatrix` component

**Files:**
- Modify: `app/src/components/OverviewMatrix.tsx`

- [ ] **Step 1: Replace stub with full implementation**

```tsx
import { buildOverviewMatrix } from '../utils/attack'
import type { Agent, Tactic } from '../types'

interface Props {
  agents: Agent[]
  tactics: Tactic[]
  onSelectAgent: (id: string) => void
}

export function OverviewMatrix({ agents, tactics, onSelectAgent }: Props) {
  const matrix = buildOverviewMatrix(agents, tactics)

  function getCell(agentId: string, tacticId: string) {
    return matrix.find((c) => c.agentId === agentId && c.tacticId === tacticId)?.count ?? 0
  }

  // Max count for color intensity
  const maxCount = Math.max(...matrix.map((c) => c.count), 1)

  function cellColor(count: number): string {
    if (count === 0) return 'var(--color-cell-empty)'
    const intensity = Math.round((count / maxCount) * 5)
    return `var(--color-cell-${intensity})`
  }

  return (
    <div className="overview-panel">
      <h2 className="overview-title">Coverage Overview</h2>
      <p className="overview-subtitle">Cells show number of ATT&amp;CK techniques covered per tactic. Click an agent name to view details.</p>

      <div className="matrix-scroll">
        <table className="matrix-table">
          <thead>
            <tr>
              <th className="matrix-th-agent">Agent</th>
              {tactics.map((t) => (
                <th key={t.id} className="matrix-th-tactic" title={t.name}>
                  <span className="tactic-th-id">{t.id}</span>
                  <span className="tactic-th-name">{t.name}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {agents.map((agent) => (
              <tr key={agent.id}>
                <td className="matrix-td-agent">
                  <button className="agent-name-btn" onClick={() => onSelectAgent(agent.id)}>
                    {agent.name}
                  </button>
                </td>
                {tactics.map((tactic) => {
                  const count = getCell(agent.id, tactic.id)
                  return (
                    <td
                      key={tactic.id}
                      className="matrix-td-cell"
                      style={{ backgroundColor: cellColor(count) }}
                      title={`${agent.name} × ${tactic.name}: ${count} techniques`}
                    >
                      {count > 0 ? count : ''}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="matrix-legend">
        <span>Coverage:</span>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <span
            key={i}
            className="legend-swatch"
            style={{ backgroundColor: i === 0 ? 'var(--color-cell-empty)' : `var(--color-cell-${i})` }}
          >
            {i === 0 ? '0' : i === 5 ? 'max' : ''}
          </span>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/src/components/OverviewMatrix.tsx
git commit -m "feat: implement OverviewMatrix heatmap"
```

---

## Task 12: Global CSS — dark theme

**Files:**
- Modify: `app/src/index.css`

- [ ] **Step 1: Replace `app/src/index.css`** with full dark theme stylesheet

```css
/* ---- CSS Custom Properties ---- */
:root {
  --bg: #0d1117;
  --bg-card: #161b22;
  --bg-hover: #1c2128;
  --border: #21262d;
  --border-light: #30363d;
  --text: #e6edf3;
  --text-muted: #8b949e;
  --accent-orange: #f0883e;
  --accent-green: #3fb950;
  --accent-blue: #58a6ff;
  --accent-green-bg: #1c2820;

  /* Matrix cell color scale (0=empty, 1–5=low→high) */
  --color-cell-empty: #161b22;
  --color-cell-1: #1c2820;
  --color-cell-2: #26522e;
  --color-cell-3: #2ea043;
  --color-cell-4: #3fb950;
  --color-cell-5: #56d364;

  --font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  --radius: 6px;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: var(--font);
  background: var(--bg);
  color: var(--text);
  font-size: 14px;
  line-height: 1.5;
}

a { color: var(--accent-blue); text-decoration: none; }
a:hover { text-decoration: underline; }

/* ---- App shell ---- */
.app { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }

.app-loading, .app-error {
  display: flex; align-items: center; justify-content: center;
  height: 100vh; color: var(--text-muted); font-size: 16px;
}
.app-error { color: #f85149; }

/* ---- Top bar ---- */
.topbar {
  flex-shrink: 0;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border-light);
  padding: 10px 20px;
  display: flex; align-items: center;
}
.topbar-logo { font-weight: 700; font-size: 15px; color: var(--accent-orange); }
.topbar-logo-sub { font-weight: 400; color: var(--text-muted); }

/* ---- Agent tabs ---- */
.agent-tabs {
  flex-shrink: 0;
  background: var(--bg);
  border-bottom: 1px solid var(--border);
  display: flex; overflow-x: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--border) transparent;
}
.agent-tab {
  flex-shrink: 0;
  padding: 10px 18px;
  font-size: 13px; cursor: pointer;
  background: none; border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-muted);
  transition: color .12s, border-color .12s, background .12s;
  font-family: var(--font);
}
.agent-tab:hover { color: var(--text); background: var(--bg-card); }
.agent-tab.active { color: var(--accent-orange); border-bottom-color: var(--accent-orange); background: var(--bg-card); }
.agent-tab.overview { color: var(--accent-blue); }
.agent-tab.overview.active { color: var(--accent-blue); border-bottom-color: var(--accent-blue); }

/* ---- Main body ---- */
.main-body { display: flex; flex: 1; overflow: hidden; }

/* ---- Technique panel ---- */
.technique-panel { flex: 1; overflow-y: auto; padding: 16px 20px; }

.tactic-section { margin-bottom: 12px; }

.tactic-header {
  display: flex; align-items: center; gap: 8px;
  width: 100%; padding: 9px 12px;
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius); cursor: pointer;
  font-family: var(--font); font-size: 13px; font-weight: 600;
  color: var(--text); text-align: left;
  transition: background .12s;
}
.tactic-header:hover { background: var(--bg-hover); }

.tactic-id { font-family: var(--font-mono); font-size: 11px; color: var(--text-muted); min-width: 60px; }
.tactic-name { flex: 1; }
.tactic-badge {
  background: #f0883e22; color: var(--accent-orange);
  padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 500;
}
.tactic-badge.zero { background: #58a6ff15; color: var(--text-muted); }
.tactic-chevron { color: var(--text-muted); font-size: 12px; }

.technique-list { padding: 3px 0 0 10px; }

.technique-row {
  display: flex; align-items: flex-start; gap: 8px;
  padding: 5px 10px;
  border-left: 2px solid var(--border);
  border-radius: 0 4px 4px 0;
  margin-bottom: 1px; font-size: 12px; cursor: default;
  transition: background .1s, border-color .1s;
}
.technique-row:hover { background: var(--bg-card); }
.technique-row.covered { border-left-color: var(--accent-green); }
.technique-row.covered:hover { border-left-color: var(--accent-green); background: var(--accent-green-bg); }

.tid { font-family: var(--font-mono); color: var(--text-muted); font-size: 11px; min-width: 72px; flex-shrink: 0; }
.tname { flex: 1; }

.covered-dot {
  width: 7px; height: 7px; background: var(--accent-green);
  border-radius: 50%; flex-shrink: 0; margin-top: 4px;
}

.sub-list { flex-basis: 100%; padding: 2px 0 0 18px; }

.sub-row {
  display: flex; align-items: center; gap: 8px;
  padding: 3px 8px;
  border-left: 2px solid #1c2128;
  border-radius: 0 3px 3px 0;
  margin-bottom: 1px; font-size: 11px;
}
.sub-row.covered { border-left-color: var(--accent-green); background: var(--accent-green-bg); }

/* ---- Paper Sidebar ---- */
.paper-sidebar {
  width: 300px; flex-shrink: 0;
  border-left: 1px solid var(--border);
  overflow-y: auto; padding: 16px;
}

.sidebar-title {
  font-size: 12px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .05em; color: var(--accent-orange);
  margin-bottom: 12px;
}
.sidebar-section-title {
  font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .05em; color: var(--text-muted);
  margin: 16px 0 8px;
}

.paper-card {
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 14px;
}
.paper-title { font-size: 13px; font-weight: 600; margin-bottom: 5px; line-height: 1.4; }
.paper-venue { font-size: 11px; color: var(--accent-blue); margin-bottom: 5px; }
.paper-meta { font-size: 11px; color: var(--text-muted); line-height: 1.6; }
.paper-link { font-size: 11px; }
.paper-tags { margin: 8px 0; }
.tag {
  display: inline-block; background: var(--accent-green-bg);
  color: var(--accent-green); border-radius: 4px;
  padding: 1px 6px; font-size: 10px; margin: 2px 2px 2px 0;
}
.paper-summary {
  font-size: 11px; color: var(--text-muted); margin-top: 8px;
  line-height: 1.55; border-top: 1px solid var(--border); padding-top: 8px;
}

.coverage-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.stat-box {
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 10px; text-align: center;
}
.stat-num { font-size: 24px; font-weight: 700; color: var(--accent-green); }
.stat-label { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: .04em; }

.covered-tactics-list { display: flex; flex-direction: column; gap: 4px; }
.covered-tactic-item {
  display: flex; align-items: center; gap: 8px;
  font-size: 11px; padding: 4px 8px;
  background: var(--bg-card); border-radius: 4px;
}
.tactic-id-small { font-family: var(--font-mono); color: var(--text-muted); font-size: 10px; min-width: 54px; }

/* ---- Overview Matrix ---- */
.overview-panel { flex: 1; overflow: auto; padding: 20px; }
.overview-title { font-size: 18px; font-weight: 700; margin-bottom: 6px; }
.overview-subtitle { font-size: 12px; color: var(--text-muted); margin-bottom: 20px; }

.matrix-scroll { overflow-x: auto; }

.matrix-table { border-collapse: collapse; white-space: nowrap; }

.matrix-th-agent {
  text-align: left; padding: 8px 16px 8px 0;
  font-size: 12px; color: var(--text-muted); font-weight: 500;
  border-bottom: 1px solid var(--border); min-width: 110px;
}
.matrix-th-tactic {
  padding: 8px 4px; text-align: center;
  font-size: 10px; color: var(--text-muted);
  border-bottom: 1px solid var(--border);
  min-width: 60px;
  writing-mode: vertical-rl; text-orientation: mixed;
  height: 90px; vertical-align: bottom;
}
.tactic-th-id { display: block; font-family: var(--font-mono); font-size: 9px; }
.tactic-th-name { display: block; font-size: 9px; max-width: 80px; overflow: hidden; text-overflow: ellipsis; }

.matrix-td-agent { padding: 4px 12px 4px 0; }
.agent-name-btn {
  background: none; border: none; color: var(--accent-blue);
  cursor: pointer; font-size: 13px; font-weight: 500;
  font-family: var(--font); padding: 0;
}
.agent-name-btn:hover { text-decoration: underline; }

.matrix-td-cell {
  width: 52px; height: 32px; text-align: center;
  font-size: 12px; font-weight: 600; color: var(--bg);
  border: 1px solid var(--bg); border-radius: 2px;
  transition: opacity .1s;
}
.matrix-td-cell:hover { opacity: .8; cursor: default; }

.matrix-legend {
  display: flex; align-items: center; gap: 4px;
  margin-top: 16px; font-size: 11px; color: var(--text-muted);
}
.legend-swatch {
  width: 24px; height: 16px; border-radius: 2px;
  display: inline-block; font-size: 9px;
  text-align: center; line-height: 16px; color: var(--bg);
}
```

- [ ] **Step 2: Verify the full app looks correct in browser — http://localhost:5173**

Check: dark theme renders, agent tabs scroll, Overview matrix shows, clicking an agent tab shows technique panel + sidebar.

- [ ] **Step 3: Commit**

```bash
git add app/src/index.css
git commit -m "feat: add dark theme CSS for full app"
```

---

## Task 13: Cloudflare Pages config + final README

**Files:**
- Create: `app/.cloudflare/` (not needed — CF Pages configured via dashboard)
- Create: `README.md` (replaces skeleton)

- [ ] **Step 1: Verify production build**

```bash
cd app && npm run build
ls dist/
```

Expected: `dist/index.html`, `dist/assets/`, `dist/papers.json`

- [ ] **Step 2: Write final `README.md`**

```markdown
# RedTeam AI × MITRE ATT&CK

Visual reference mapping red-team AI agent research papers to MITRE ATT&CK Enterprise techniques.

**Live:** [Deploy to Cloudflare Pages — see setup below]

## What's in here

| Path | Purpose |
|------|---------|
| `app/` | Static SPA → Cloudflare Pages |
| `editor/` | Local admin editor (React + Express) |
| `app/public/papers.json` | All agent + paper + technique data |
| `app/src/data/attack-enterprise.json` | Trimmed MITRE ATT&CK Enterprise v16.1 |

## Cloudflare Pages Setup

1. Fork / push this repo to GitHub
2. In Cloudflare Pages → New Project → Connect to Git
3. Settings:
   - **Root directory:** `app`
   - **Build command:** `npm install && npm run build`
   - **Build output directory:** `dist`
4. Deploy

## Running the editor locally

```bash
cd editor
npm install
npm run dev        # starts frontend :5174 + backend :3001
```

Open http://localhost:5174, select an agent, toggle techniques, save.
Then `cd app && npm run build` → commit + push → CF Pages auto-deploys.

## Updating ATT&CK data (one-time or when MITRE releases new version)

```bash
node scripts/fetch-attack-data.js
git add app/src/data/attack-enterprise.json
git commit -m "chore: update ATT&CK data to vX.X"
```

## License

MIT
```

- [ ] **Step 3: Commit**

```bash
cd /Users/jelyf1shhhhhh/Documents/code/red-team-ai-agent-summary
git add README.md
git commit -m "docs: add full README with CF Pages setup instructions"
```

---

## Task 14: `editor/` — Express backend

**Files:**
- Create: `editor/server/index.js`
- Create: `editor/package.json`

- [ ] **Step 1: Create `editor/package.json`**

```json
{
  "name": "red-team-agent-editor",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "concurrently \"node server/index.js\" \"vite\"",
    "build": "vite build",
    "server": "node server/index.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "concurrently": "^8.2.2"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.1",
    "@types/react": "^18.2.55",
    "@types/react-dom": "^18.2.19",
    "typescript": "^5.2.2",
    "vite": "^5.1.4"
  }
}
```

- [ ] **Step 2: Install deps**

```bash
cd editor && npm install && cd ..
```

- [ ] **Step 3: Create `editor/server/index.js`**

```js
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;

const PAPERS_PATH = path.resolve(__dirname, '../../app/public/papers.json');
const ATTACK_PATH = path.resolve(__dirname, '../../app/src/data/attack-enterprise.json');

app.use(cors({ origin: 'http://localhost:5174' }));
app.use(express.json({ limit: '10mb' }));

app.get('/api/papers', (req, res) => {
  try {
    const data = fs.readFileSync(PAPERS_PATH, 'utf8');
    res.json(JSON.parse(data));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/papers', (req, res) => {
  try {
    const incoming = req.body;
    if (!incoming.agents || !Array.isArray(incoming.agents)) {
      return res.status(400).json({ error: 'Invalid papers data: missing agents array' });
    }
    incoming.lastUpdated = new Date().toISOString().split('T')[0];
    fs.writeFileSync(PAPERS_PATH, JSON.stringify(incoming, null, 2));
    res.json({ ok: true, lastUpdated: incoming.lastUpdated });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/attack', (req, res) => {
  try {
    const data = fs.readFileSync(ATTACK_PATH, 'utf8');
    res.json(JSON.parse(data));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => console.log(`Editor API running on http://localhost:${PORT}`));
```

- [ ] **Step 4: Verify server starts**

```bash
cd editor && node server/index.js &
curl http://localhost:3001/api/papers | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log('Agents:', d.agents.length)"
kill %1
```

Expected: `Agents: 9`

- [ ] **Step 5: Commit**

```bash
cd /Users/jelyf1shhhhhh/Documents/code/red-team-ai-agent-summary
git add editor/package.json editor/server/
git commit -m "feat: add editor Express backend with papers read/write API"
```

---

## Task 15: `editor/` — Vite scaffold + types

**Files:**
- Create: `editor/index.html`
- Create: `editor/vite.config.ts`
- Create: `editor/tsconfig.json`
- Create: `editor/src/types/index.ts`
- Create: `editor/src/main.tsx`

- [ ] **Step 1: Create `editor/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>RedTeam AI — Editor</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Create `editor/vite.config.ts`**

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
```

- [ ] **Step 3: Create `editor/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Copy types to `editor/src/types/index.ts`**

Copy the exact contents of `app/src/types/index.ts` (same types are needed in editor).

- [ ] **Step 5: Create `editor/src/main.tsx`**

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 6: Create `editor/src/index.css`** (minimal editor styling)

```css
:root {
  --bg: #0d1117; --bg-card: #161b22; --bg-hover: #1c2128;
  --border: #21262d; --border-light: #30363d;
  --text: #e6edf3; --text-muted: #8b949e;
  --accent: #f0883e; --green: #3fb950; --blue: #58a6ff;
  --font: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --mono: 'SFMono-Regular', Consolas, monospace;
  --radius: 6px;
}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: var(--font); background: var(--bg); color: var(--text); font-size: 13px; }
input, textarea, select, button { font-family: var(--font); font-size: 13px; }
label { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: .04em; }

.editor-shell { display: flex; height: 100vh; overflow: hidden; }

/* Left sidebar */
.agent-sidebar { width: 200px; flex-shrink: 0; border-right: 1px solid var(--border); overflow-y: auto; padding: 12px 0; }
.sidebar-header { padding: 0 12px 10px; font-size: 12px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: .05em; display: flex; justify-content: space-between; align-items: center; }
.agent-item { padding: 8px 12px; cursor: pointer; font-size: 13px; color: var(--text-muted); transition: background .1s, color .1s; }
.agent-item:hover { background: var(--bg-card); color: var(--text); }
.agent-item.selected { background: var(--bg-hover); color: var(--accent); font-weight: 600; }

/* Main area */
.editor-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.editor-topbar { padding: 12px 20px; background: var(--bg-card); border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; }
.editor-topbar h1 { font-size: 15px; font-weight: 700; color: var(--accent); }
.editor-tabs { display: flex; border-bottom: 1px solid var(--border); }
.editor-tab { padding: 10px 20px; font-size: 13px; cursor: pointer; background: none; border: none; border-bottom: 2px solid transparent; color: var(--text-muted); font-family: var(--font); }
.editor-tab.active { color: var(--accent); border-bottom-color: var(--accent); }
.editor-content { flex: 1; overflow-y: auto; padding: 20px; }

/* Form */
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.form-field { display: flex; flex-direction: column; gap: 4px; }
.form-field.full { grid-column: 1 / -1; }
.form-field input, .form-field textarea {
  background: var(--bg-card); border: 1px solid var(--border);
  color: var(--text); padding: 7px 10px; border-radius: var(--radius);
  outline: none; transition: border-color .12s;
}
.form-field input:focus, .form-field textarea:focus { border-color: var(--accent); }
.form-field textarea { resize: vertical; min-height: 80px; }

/* Save button */
.btn-save {
  padding: 8px 20px; background: var(--accent); color: white;
  border: none; border-radius: var(--radius); cursor: pointer;
  font-weight: 600; font-size: 13px; transition: opacity .12s;
}
.btn-save:hover { opacity: .85; }
.btn-save:disabled { opacity: .4; cursor: default; }
.btn-add { padding: 4px 8px; background: none; border: 1px solid var(--border); color: var(--text-muted); border-radius: var(--radius); cursor: pointer; font-size: 11px; }
.btn-add:hover { border-color: var(--accent); color: var(--accent); }
.btn-danger { background: none; border: none; color: #f85149; cursor: pointer; font-size: 11px; padding: 4px; }
.save-status { font-size: 11px; padding: 4px 10px; border-radius: var(--radius); }
.save-status.ok { background: #1c2820; color: var(--green); }
.save-status.err { background: #2d1117; color: #f85149; }

/* Technique selector */
.tech-selector-tactic { margin-bottom: 12px; }
.tech-selector-tactic-header {
  display: flex; align-items: center; gap: 8px;
  padding: 7px 10px; background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius); cursor: pointer; font-size: 12px; font-weight: 600;
  width: 100%; background: none; color: var(--text); font-family: var(--font); border-radius: 4px;
}
.tech-selector-tactic-header .tid { font-family: var(--mono); font-size: 10px; color: var(--text-muted); min-width: 55px; }
.tech-row-selector {
  display: flex; align-items: center; gap: 8px;
  padding: 5px 10px; border-left: 2px solid var(--border);
  margin: 1px 0; font-size: 12px; cursor: pointer; border-radius: 0 3px 3px 0;
  transition: background .1s;
}
.tech-row-selector:hover { background: var(--bg-card); }
.tech-row-selector.covered { border-left-color: var(--green); background: #1c2820; }
.tech-row-selector input[type="checkbox"] { accent-color: var(--green); width: 14px; height: 14px; flex-shrink: 0; cursor: pointer; }
.sub-row-selector { display: flex; align-items: center; gap: 8px; padding: 3px 10px 3px 24px; font-size: 11px; cursor: pointer; border-left: 2px solid transparent; margin: 1px 0; }
.sub-row-selector:hover { background: var(--bg-card); }
.sub-row-selector.covered { border-left-color: var(--green); background: #1c2820; }
.sub-row-selector input[type="checkbox"] { accent-color: var(--green); width: 12px; height: 12px; flex-shrink: 0; cursor: pointer; }
.notes-input { flex: 1; background: transparent; border: none; border-bottom: 1px solid var(--border); color: var(--text-muted); padding: 1px 4px; font-size: 10px; outline: none; min-width: 0; }
.notes-input:focus { border-bottom-color: var(--accent); color: var(--text); }
```

- [ ] **Step 7: Commit**

```bash
cd /Users/jelyf1shhhhhh/Documents/code/red-team-ai-agent-summary
git add editor/
git commit -m "feat: scaffold editor app with vite+react+ts and CSS"
```

---

## Task 16: `editor/` — `AgentList` component

**Files:**
- Create: `editor/src/components/AgentList.tsx`

- [ ] **Step 1: Create `editor/src/components/AgentList.tsx`**

```tsx
import type { Agent } from '../types'

interface Props {
  agents: Agent[]
  selectedId: string | null
  onSelect: (id: string) => void
  onAdd: () => void
  onDelete: (id: string) => void
}

export function AgentList({ agents, selectedId, onSelect, onAdd, onDelete }: Props) {
  return (
    <div className="agent-sidebar">
      <div className="sidebar-header">
        <span>Agents</span>
        <button className="btn-add" onClick={onAdd} title="Add agent">+ Add</button>
      </div>
      {agents.map((agent) => (
        <div
          key={agent.id}
          className={`agent-item${selectedId === agent.id ? ' selected' : ''}`}
          onClick={() => onSelect(agent.id)}
        >
          <span>{agent.name}</span>
          {selectedId === agent.id && (
            <button
              className="btn-danger"
              onClick={(e) => { e.stopPropagation(); onDelete(agent.id) }}
              title="Delete agent"
            >
              ✕
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add editor/src/components/AgentList.tsx
git commit -m "feat: add AgentList component for editor"
```

---

## Task 17: `editor/` — `PaperForm` component

**Files:**
- Create: `editor/src/components/PaperForm.tsx`

- [ ] **Step 1: Create `editor/src/components/PaperForm.tsx`**

```tsx
import type { Agent } from '../types'

interface Props {
  agent: Agent
  onChange: (updated: Agent) => void
}

function field(label: string, value: string, onChange: (v: string) => void, full = false, textarea = false) {
  return (
    <div className={`form-field${full ? ' full' : ''}`}>
      <label>{label}</label>
      {textarea
        ? <textarea value={value} onChange={(e) => onChange(e.target.value)} />
        : <input type="text" value={value} onChange={(e) => onChange(e.target.value)} />}
    </div>
  )
}

export function PaperForm({ agent, onChange }: Props) {
  function updatePaper(key: keyof typeof agent.paper, value: string | number) {
    onChange({ ...agent, paper: { ...agent.paper, [key]: value } })
  }

  function updateAgentField(key: 'id' | 'name', value: string) {
    onChange({ ...agent, [key]: value })
  }

  return (
    <div>
      <div className="form-grid" style={{ marginBottom: 20 }}>
        {field('Agent ID (slug)', agent.id, (v) => updateAgentField('id', v))}
        {field('Display Name', agent.name, (v) => updateAgentField('name', v))}
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-muted)', marginBottom: 10 }}>Paper</div>
      <div className="form-grid">
        {field('Title', agent.paper.title, (v) => updatePaper('title', v), true)}
        {field('Venue', agent.paper.venue, (v) => updatePaper('venue', v))}
        {field('Year', String(agent.paper.year), (v) => updatePaper('year', Number(v)))}
        {field('Affiliation', agent.paper.affiliation, (v) => updatePaper('affiliation', v))}
        {field('arXiv ID', agent.paper.arxiv ?? '', (v) => updatePaper('arxiv', v))}
        {field('URL', agent.paper.url, (v) => updatePaper('url', v))}
        {field('Authors (comma-separated)', agent.paper.authors.join(', '), (v) =>
          onChange({ ...agent, paper: { ...agent.paper, authors: v.split(',').map((s) => s.trim()) } })
        , true)}
        {field('Tags (comma-separated)', agent.paper.tags.join(', '), (v) =>
          onChange({ ...agent, paper: { ...agent.paper, tags: v.split(',').map((s) => s.trim()).filter(Boolean) } })
        , true)}
        {field('Summary', agent.paper.summary, (v) => updatePaper('summary', v), true, true)}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add editor/src/components/PaperForm.tsx
git commit -m "feat: add PaperForm component for editing paper metadata"
```

---

## Task 18: `editor/` — `TechniqueSelector` component

**Files:**
- Create: `editor/src/components/TechniqueSelector.tsx`

- [ ] **Step 1: Create `editor/src/components/TechniqueSelector.tsx`**

```tsx
import { useState } from 'react'
import type { Agent, AttackData, TechniqueMapping } from '../types'

interface Props {
  agent: Agent
  attack: AttackData
  onChange: (updated: Agent) => void
}

export function TechniqueSelector({ agent, attack, onChange }: Props) {
  const [openTactics, setOpenTactics] = useState<Set<string>>(new Set())

  function toggleTactic(id: string) {
    setOpenTactics((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function isCovered(id: string) {
    return agent.techniques.some((t) => t.id === id)
  }

  function getNotes(id: string) {
    return agent.techniques.find((t) => t.id === id)?.notes ?? ''
  }

  function toggleTechnique(id: string) {
    const existing = agent.techniques.find((t) => t.id === id)
    let updated: TechniqueMapping[]
    if (existing) {
      updated = agent.techniques.filter((t) => t.id !== id)
    } else {
      updated = [...agent.techniques, { id, notes: '' }]
    }
    onChange({ ...agent, techniques: updated })
  }

  function updateNotes(id: string, notes: string) {
    const updated = agent.techniques.map((t) =>
      t.id === id ? { ...t, notes } : t
    )
    onChange({ ...agent, techniques: updated })
  }

  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
        {agent.techniques.length} techniques selected. Click to toggle. Edit notes inline.
      </div>
      {attack.tactics.map((tactic) => {
        const isOpen = openTactics.has(tactic.id)
        const coveredCount = tactic.techniques.filter((t) => isCovered(t.id)).length
        return (
          <div key={tactic.id} className="tech-selector-tactic">
            <button
              className="tech-selector-tactic-header"
              onClick={() => toggleTactic(tactic.id)}
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 12px', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: 'var(--text)', fontFamily: 'inherit', fontWeight: 600, fontSize: 13, width: '100%', textAlign: 'left' }}
            >
              <span className="tid">{tactic.id}</span>
              <span style={{ flex: 1 }}>{tactic.name}</span>
              <span style={{ fontSize: 11, background: coveredCount > 0 ? '#3fb95022' : '#58a6ff15', color: coveredCount > 0 ? 'var(--green)' : 'var(--text-muted)', padding: '2px 8px', borderRadius: 10 }}>
                {coveredCount} covered
              </span>
              <span style={{ color: 'var(--text-muted)' }}>{isOpen ? '▾' : '▸'}</span>
            </button>

            {isOpen && (
              <div style={{ paddingLeft: 8 }}>
                {tactic.techniques.map((tech) => {
                  const covered = isCovered(tech.id)
                  return (
                    <div key={tech.id}>
                      <div
                        className={`tech-row-selector${covered ? ' covered' : ''}`}
                        onClick={() => toggleTechnique(tech.id)}
                      >
                        <input
                          type="checkbox"
                          checked={covered}
                          onChange={() => toggleTechnique(tech.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className="tid">{tech.id}</span>
                        <span style={{ flex: 1 }}>{tech.name}</span>
                        {covered && (
                          <input
                            className="notes-input"
                            placeholder="notes..."
                            value={getNotes(tech.id)}
                            onChange={(e) => updateNotes(tech.id, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        )}
                      </div>
                      {tech.sub_techniques.map((sub) => {
                        const subCovered = isCovered(sub.id)
                        return (
                          <div
                            key={sub.id}
                            className={`sub-row-selector${subCovered ? ' covered' : ''}`}
                            onClick={() => toggleTechnique(sub.id)}
                          >
                            <input
                              type="checkbox"
                              checked={subCovered}
                              onChange={() => toggleTechnique(sub.id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <span className="tid">{sub.id}</span>
                            <span style={{ flex: 1 }}>{sub.name}</span>
                            {subCovered && (
                              <input
                                className="notes-input"
                                placeholder="notes..."
                                value={getNotes(sub.id)}
                                onChange={(e) => updateNotes(sub.id, e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                              />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add editor/src/components/TechniqueSelector.tsx
git commit -m "feat: add TechniqueSelector with click-to-toggle and inline notes"
```

---

## Task 19: `editor/` — App assembly + save flow

**Files:**
- Create: `editor/src/App.tsx`

- [ ] **Step 1: Create `editor/src/App.tsx`**

```tsx
import { useState, useEffect, useCallback } from 'react'
import { AgentList } from './components/AgentList'
import { PaperForm } from './components/PaperForm'
import { TechniqueSelector } from './components/TechniqueSelector'
import type { PapersData, Agent, AttackData } from './types'

type TabId = 'paper' | 'techniques'
type SaveStatus = { type: 'idle' } | { type: 'saving' } | { type: 'ok' } | { type: 'err'; msg: string }

const BLANK_AGENT: Agent = {
  id: 'new-agent-' + Date.now(),
  name: 'New Agent',
  paper: {
    title: '', venue: '', year: new Date().getFullYear(),
    authors: [], arxiv: '', url: '', affiliation: '', summary: '', tags: [],
  },
  techniques: [],
}

export default function App() {
  const [papers, setPapers] = useState<PapersData | null>(null)
  const [attack, setAttack] = useState<AttackData | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tab, setTab] = useState<TabId>('paper')
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ type: 'idle' })

  useEffect(() => {
    fetch('/api/papers').then((r) => r.json()).then(setPapers)
    fetch('/api/attack').then((r) => r.json()).then(setAttack)
  }, [])

  const selectedAgent = papers?.agents.find((a) => a.id === selectedId) ?? null

  function updateAgent(updated: Agent) {
    if (!papers) return
    setPapers({
      ...papers,
      agents: papers.agents.map((a) => (a.id === updated.id ? updated : a)),
    })
  }

  function addAgent() {
    if (!papers) return
    const blank = { ...BLANK_AGENT, id: 'new-agent-' + Date.now() }
    setPapers({ ...papers, agents: [...papers.agents, blank] })
    setSelectedId(blank.id)
  }

  function deleteAgent(id: string) {
    if (!papers) return
    if (!confirm(`Delete agent "${id}"?`)) return
    setPapers({ ...papers, agents: papers.agents.filter((a) => a.id !== id) })
    setSelectedId(null)
  }

  const save = useCallback(async () => {
    if (!papers) return
    setSaveStatus({ type: 'saving' })
    try {
      const res = await fetch('/api/papers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(papers),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setSaveStatus({ type: 'ok' })
      setTimeout(() => setSaveStatus({ type: 'idle' }), 2000)
    } catch (e: unknown) {
      setSaveStatus({ type: 'err', msg: e instanceof Error ? e.message : String(e) })
    }
  }, [papers])

  if (!papers || !attack) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#8b949e' }}>Loading...</div>
  }

  return (
    <div className="editor-shell">
      <AgentList
        agents={papers.agents}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onAdd={addAgent}
        onDelete={deleteAgent}
      />

      <div className="editor-main">
        <div className="editor-topbar">
          <h1>RedTeam AI Editor</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {saveStatus.type === 'ok' && <span className="save-status ok">Saved ✓</span>}
            {saveStatus.type === 'err' && <span className="save-status err">Error: {saveStatus.msg}</span>}
            <button className="btn-save" onClick={save} disabled={saveStatus.type === 'saving'}>
              {saveStatus.type === 'saving' ? 'Saving…' : 'Save to papers.json'}
            </button>
          </div>
        </div>

        {selectedAgent ? (
          <>
            <div className="editor-tabs">
              <button className={`editor-tab${tab === 'paper' ? ' active' : ''}`} onClick={() => setTab('paper')}>Paper Info</button>
              <button className={`editor-tab${tab === 'techniques' ? ' active' : ''}`} onClick={() => setTab('techniques')}>
                Techniques ({selectedAgent.techniques.length})
              </button>
            </div>

            <div className="editor-content">
              {tab === 'paper' && <PaperForm agent={selectedAgent} onChange={updateAgent} />}
              {tab === 'techniques' && (
                <TechniqueSelector agent={selectedAgent} attack={attack} onChange={updateAgent} />
              )}
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b949e' }}>
            Select an agent from the sidebar to edit
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify editor runs end-to-end**

```bash
cd editor && npm run dev
```

Open http://localhost:5174. Verify:
- Agent list loads from `papers.json`
- Clicking an agent shows paper form
- Switching to Techniques tab shows ATT&CK matrix
- Clicking a technique checks/unchecks it
- Save button writes to `app/public/papers.json`

- [ ] **Step 3: Final commit**

```bash
cd /Users/jelyf1shhhhhh/Documents/code/red-team-ai-agent-summary
git add editor/src/
git commit -m "feat: complete editor app with agent CRUD, paper form, technique selector, and save"
```

---

## Task 20: Final verification + cleanup

- [ ] **Step 1: Run app unit tests**

```bash
cd app && npx vitest run
```

Expected: all tests pass.

- [ ] **Step 2: Verify app production build**

```bash
cd app && npm run build
ls dist/
```

Expected: `index.html`, `assets/`, `papers.json` in `dist/`.

- [ ] **Step 3: Smoke test production build locally**

```bash
cd app && npx vite preview
```

Open http://localhost:4173 — verify full app works.

- [ ] **Step 4: Check `.gitignore` excludes all right things**

```bash
cd /Users/jelyf1shhhhhh/Documents/code/red-team-ai-agent-summary
git status
```

Expected: no `node_modules/`, no `dist/`, no `.superpowers/` in untracked files.

- [ ] **Step 5: Final commit**

```bash
git add -A
git status  # review
git commit -m "chore: final cleanup and verification"
```

- [ ] **Step 6: Summary of Cloudflare Pages connection**

In Cloudflare Pages dashboard:
- **Repository:** this GitHub repo
- **Root directory:** `app`
- **Build command:** `npm install && npm run build`
- **Build output directory:** `dist`
- **Environment variables:** none needed

Every push to main → CF Pages rebuilds automatically.

---

## Self-Review Notes

- All 9 agents populated in `papers.json` with technique mappings ✓
- ATT&CK data trimmed script committed ✓
- Utility functions tested (7 tests) ✓
- Editor saves back to `app/public/papers.json` — correct path ✓
- CF Pages config documented in README ✓
- `.superpowers/` excluded from git ✓
- No TBDs or placeholders remain ✓
