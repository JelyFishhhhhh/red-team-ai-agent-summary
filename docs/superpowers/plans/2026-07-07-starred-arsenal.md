# Starred Arsenal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Inventory the red-team/AI relevant subset of the user's 413 GitHub stars, score each against the ATT&CK coverage rubric, and render it as a new "Starred Arsenal" section in the existing `red-team-ai-agent-summary` app.

**Architecture:** Two phases gated by a human checkpoint. Phase A fetches all stars and auto-classifies them into a triage table for human confirmation. Phase B builds the data schema + validator (honesty guard), the UI section (3 views reusing existing coverage components), and authors rubric-compliant coverage data per category. Data lives in a new `app/public/arsenal.json`; the 22 research agents in `papers.json` are untouched.

**Tech Stack:** Node CommonJS scripts (`scripts/`), `gh` CLI, React 19 + react-router-dom, Vite, Vitest + @testing-library/react, TypeScript.

## Global Constraints

- Coverage labels are exactly `covered | partial | tool-dep | not-covered` (rubric). Autonomy is `L1 | L2 | L3 | null`. `kind` is `ai-agent | agent-framework | tool | lab-dataset`.
- **Honesty guard (rubric hard rule):** every `techniques[]` entry MUST have a `source` `{tier, ref}`. Unsourced → `not-covered` or dropped. No benchmark-backed `covered` without real benchmark evidence.
- Rubric of record: `wiki/Red-Team/ATT&CK-Coverage-Rubric.md` / `docs/superpowers/specs/2026-05-18-technique-coverage-rubric.md`.
- Do NOT modify `app/public/papers.json` contents (read-only source for the 19-tool seed).
- Scripts run with `node scripts/<name>.js`. UI tests run with `npm run test:run` from `app/`.
- ATT&CK tactic order (14, fixed): reconnaissance, resource-development, initial-access, execution, persistence, privilege-escalation, defense-evasion, credential-access, discovery, lateral-movement, collection, command-and-control, exfiltration, impact.

---

## File Structure

**Scripts (repo root `scripts/`)**
- `fetch-stars.js` — pull all stars via `gh` → `scripts/data/arsenal.raw.json`
- `classify-stars.js` — heuristic classifier → `scripts/data/arsenal.triage.json` + `docs/coverage-analysis/arsenal-triage.md`
- `validate-arsenal.js` — schema + honesty-guard validator for `app/public/arsenal.json`
- `seed-arsenal-from-tools.js` — transform `papers.json` `tools[]` → arsenal items
- `data/` — script intermediates (git-ignored except triage output)

**App (`app/src/`)**
- `types/index.ts` — add `ArsenalItem`, `ArsenalData`, `ItemKind`
- `utils/attack.ts` — generalize derivation fn signatures to structural `{ techniques }`
- `utils/arsenal.ts` (+ `arsenal.test.ts`) — inventory-row derivations (tactic span, coverage counts, sort/filter)
- `hooks/useArsenal.ts` — fetch `/arsenal.json`
- `pages/ArsenalPage.tsx` — section shell, sub-nav for 3 views
- `components/ArsenalTable.tsx` (+ test) — inventory table (sort/filter)
- `components/ArsenalMatrix.tsx` — item×tactic heatmap (reuses OverviewMatrix rendering)
- `components/ArsenalItemDetail.tsx` — per-item technique breakdown (reuses TacticSection/TechniqueRow)
- `App.tsx` — add `/arsenal` nav + routes

**Data**
- `app/public/arsenal.json` — `{ version, lastUpdated, items: ArsenalItem[] }`

---

# PHASE A — Fetch + Classify (sequential; gates Phase B)

### Task 1: Fetch all stars

**Files:**
- Create: `scripts/fetch-stars.js`
- Create (output): `scripts/data/arsenal.raw.json`

**Interfaces:**
- Produces: `arsenal.raw.json` = array of `{ repo, name, url, description, stars, language, topics: string[] }`

- [ ] **Step 1: Write the fetch script**

```js
#!/usr/bin/env node
// Fetch all of the authenticated user's GitHub stars via gh CLI.
// Run: node scripts/fetch-stars.js
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'data', 'arsenal.raw.json');
fs.mkdirSync(path.dirname(OUT), { recursive: true });

// gh paginates; -q flattens each page's objects we care about.
const raw = execSync(
  `gh api user/starred --paginate ` +
  `-q '.[] | {repo: .full_name, name: .name, url: .html_url, ` +
  `description: .description, stars: .stargazers_count, ` +
  `language: .language, topics: .topics}'`,
  { maxBuffer: 64 * 1024 * 1024 }
).toString();

// --paginate concatenates JSON objects (newline-delimited); parse per line.
const items = raw.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
fs.writeFileSync(OUT, JSON.stringify(items, null, 2));
console.log(`Wrote ${items.length} starred repos to ${OUT}`);
```

- [ ] **Step 2: Run it**

Run: `node scripts/fetch-stars.js`
Expected: `Wrote 413 starred repos to .../arsenal.raw.json` (count ~413)

- [ ] **Step 3: Sanity check output shape**

Run: `node -e "const a=require('./scripts/data/arsenal.raw.json'); console.log(a.length, Object.keys(a[0]))"`
Expected: count + keys `[ 'repo','name','url','description','stars','language','topics' ]`

- [ ] **Step 4: Commit**

```bash
git add scripts/fetch-stars.js .gitignore
git commit -m "feat(arsenal): fetch-stars script"
```
(Add `scripts/data/arsenal.raw.json` to `.gitignore` — it's a regenerable intermediate.)

---

### Task 2: Auto-classify into triage table

**Files:**
- Create: `scripts/classify-stars.js`
- Create: `scripts/classify-lexicon.js` (exported lexicon, testable)
- Create: `scripts/classify-lexicon.test.js`
- Create (output): `scripts/data/arsenal.triage.json`, `docs/coverage-analysis/arsenal-triage.md`

**Interfaces:**
- Consumes: `arsenal.raw.json`
- Produces: `classify(item) -> { kind, relevant, reason }` where `kind ∈ {ai-agent,agent-framework,tool,lab-dataset,excluded}`, `relevant ∈ {true,false,null}` (null = ambiguous, needs human)

- [ ] **Step 1: Write the failing test**

```js
// scripts/classify-lexicon.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const { classify } = require('./classify-lexicon');

test('LLM pentest agent -> ai-agent, relevant', () => {
  const r = classify({ name: 'PentestGPT', description: 'LLM automated penetration testing', topics: ['llm','pentest'], language: 'Python' });
  assert.equal(r.kind, 'ai-agent');
  assert.equal(r.relevant, true);
});

test('adversary emulation platform -> agent-framework', () => {
  const r = classify({ name: 'caldera', description: 'Automated adversary emulation platform', topics: ['att&ck','security'], language: 'Python' });
  assert.equal(r.kind, 'agent-framework');
  assert.equal(r.relevant, true);
});

test('classic offensive tool -> tool', () => {
  const r = classify({ name: 'nuclei', description: 'Fast vulnerability scanner', topics: ['security','pentest'], language: 'Go' });
  assert.equal(r.kind, 'tool');
  assert.equal(r.relevant, true);
});

test('unrelated repo -> excluded, not relevant', () => {
  const r = classify({ name: 'my-blog', description: 'Personal blog built with Astro', topics: ['blog'], language: 'TypeScript' });
  assert.equal(r.kind, 'excluded');
  assert.equal(r.relevant, false);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test scripts/classify-lexicon.test.js`
Expected: FAIL (cannot find module `./classify-lexicon`)

- [ ] **Step 3: Write the lexicon + classifier**

```js
// scripts/classify-lexicon.js
const AGENT = ['llm','gpt','agent','autonomous','copilot','langchain','langgraph','autogpt'];
const REDTEAM = ['pentest','penetration','red-team','redteam','offensive','exploit','recon',
  'c2','command-and-control','adversary','att&ck','attack','malware','payload','post-exploitation',
  'privilege-escalation','lateral','credential','bloodhound','cobalt','metasploit','osint','fuzzing'];
const FRAMEWORK = ['emulation','orchestration','framework','platform','breach-and-attack','purple'];
const LAB = ['ctf','benchmark','dataset','lab','vulnerable','training','range','testbed','writeup','writeups'];

function hay(item) {
  return [item.name, item.description, ...(item.topics || [])].join(' ').toLowerCase();
}
function any(h, words) { return words.some((w) => h.includes(w)); }

function classify(item) {
  const h = hay(item);
  const isAgent = any(h, AGENT);
  const isRed = any(h, REDTEAM);
  const isFramework = any(h, FRAMEWORK);
  const isLab = any(h, LAB);

  if (isRed && isAgent) return { kind: 'ai-agent', relevant: true, reason: 'LLM/agent + offensive keywords' };
  if (isRed && isFramework) return { kind: 'agent-framework', relevant: true, reason: 'offensive + framework/emulation' };
  if (isRed) return { kind: 'tool', relevant: true, reason: 'offensive tooling keywords' };
  if (isLab && (isRed || isAgent)) return { kind: 'lab-dataset', relevant: true, reason: 'lab/benchmark + security' };
  if (isAgent && isFramework) return { kind: 'agent-framework', relevant: null, reason: 'agent framework, offensive use unclear' };
  if (isAgent || isLab) return { kind: 'excluded', relevant: null, reason: 'AI/lab but no offensive signal — confirm' };
  return { kind: 'excluded', relevant: false, reason: 'no red-team/AI signal' };
}
module.exports = { classify, AGENT, REDTEAM, FRAMEWORK, LAB };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/classify-lexicon.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: Write the driver that emits triage JSON + markdown**

```js
// scripts/classify-stars.js
const fs = require('fs');
const path = require('path');
const { classify } = require('./classify-lexicon');

const items = require('./data/arsenal.raw.json');
const scored = items.map((it) => ({ ...it, ...classify(it) }));

fs.writeFileSync(path.join(__dirname, 'data', 'arsenal.triage.json'), JSON.stringify(scored, null, 2));

const order = { true: 0, null: 1, false: 2 };
scored.sort((a, b) => order[a.relevant] - order[b.relevant] || (b.stars - a.stars));
const rows = scored.map((s) =>
  `| ${s.repo} | ${s.kind} | ${s.relevant === null ? '❓' : s.relevant ? '✅' : '—'} | ${s.stars} | ${(s.description || '').replace(/\|/g, '/').slice(0, 80)} |`
).join('\n');
const md = `# Starred Arsenal — Triage (${new Date().toISOString().slice(0,10)})\n\n` +
  `Total: ${scored.length} | relevant: ${scored.filter(s=>s.relevant===true).length} | ` +
  `ambiguous: ${scored.filter(s=>s.relevant===null).length} | excluded: ${scored.filter(s=>s.relevant===false).length}\n\n` +
  `| repo | kind | keep | stars | description |\n|---|---|---|---|---|\n${rows}\n`;
const outMd = path.join(__dirname, '..', 'docs', 'coverage-analysis', 'arsenal-triage.md');
fs.writeFileSync(outMd, md);
console.log(`Triage written. Review: ${outMd}`);
```

- [ ] **Step 6: Run it**

Run: `node scripts/classify-stars.js`
Expected: `Triage written...`; open `docs/coverage-analysis/arsenal-triage.md`

- [ ] **Step 7: Commit**

```bash
git add scripts/classify-stars.js scripts/classify-lexicon.js scripts/classify-lexicon.test.js docs/coverage-analysis/arsenal-triage.md
git commit -m "feat(arsenal): heuristic classifier + triage table"
```

---

## ⛔ CHECKPOINT (human)

Stop. Present `docs/coverage-analysis/arsenal-triage.md` to the user. The user:
- confirms the `relevant=true` set,
- resolves every `relevant=null` (❓) row into keep/drop + correct `kind`,
- may re-bucket any misclassified row.

Record the confirmed set as `scripts/data/arsenal.confirmed.json` (same shape as triage, with `relevant` resolved to true/false and `kind` final). Phase B operates only on `relevant=true` items. **Do not start Phase B until this is done.**

---

# PHASE B — Schema, UI, Coverage Data

> Infra tasks 3–9 are independent of triage *content* (depend only on the schema) and can run in parallel with each other. Coverage-authoring (Task 10) depends on Task 3's validator + the confirmed set.

### Task 3: Types + arsenal validator (honesty guard)

**Files:**
- Modify: `app/src/types/index.ts` (append)
- Create: `scripts/validate-arsenal.js`
- Create: `scripts/validate-arsenal.test.js`

**Interfaces:**
- Produces (TS): `ItemKind`, `ArsenalItem`, `ArsenalData`
- Produces (JS): `validateArsenal(data) -> { ok: boolean, errors: string[] }`

- [ ] **Step 1: Add TypeScript types**

```ts
// append to app/src/types/index.ts
export type ItemKind = 'ai-agent' | 'agent-framework' | 'tool' | 'lab-dataset'

export interface ArsenalItem {
  id: string
  repo: string
  name: string
  url: string
  stars: number
  language: string | null
  kind: ItemKind
  category: string
  description: string
  topics: string[]
  autonomy: 'L1' | 'L2' | 'L3' | null
  has_paper: boolean
  techniques: TechniqueMapping[]   // reuses existing rubric-labeled mapping
  benchmark: Benchmark | null
}

export interface ArsenalData {
  version: string
  lastUpdated: string
  items: ArsenalItem[]
}
```

- [ ] **Step 2: Write the failing validator test**

```js
// scripts/validate-arsenal.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const { validateArsenal } = require('./validate-arsenal');

const base = { version: '1', lastUpdated: '2026-07-07', items: [] };
const item = {
  id: 'x', repo: 'a/x', name: 'X', url: 'http://x', stars: 1, language: 'Go',
  kind: 'tool', category: 'recon', description: 'd', topics: [], autonomy: null,
  has_paper: false, benchmark: null,
  techniques: [{ id: 'T1595', coverage: 'tool-dep', notes: 'n', source: { tier: 'T2', ref: 'README' } }],
};

test('valid item passes', () => {
  assert.equal(validateArsenal({ ...base, items: [item] }).ok, true);
});
test('technique without source fails (honesty guard)', () => {
  const bad = { ...item, techniques: [{ id: 'T1595', coverage: 'covered', notes: 'n' }] };
  const r = validateArsenal({ ...base, items: [bad] });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('source')));
});
test('bad coverage enum fails', () => {
  const bad = { ...item, techniques: [{ id: 'T1', coverage: 'yes', notes: '', source: { tier: 'T2', ref: 'r' } }] };
  assert.equal(validateArsenal({ ...base, items: [bad] }).ok, false);
});
test('non-null autonomy on kind=tool fails', () => {
  const bad = { ...item, autonomy: 'L3' };
  assert.equal(validateArsenal({ ...base, items: [bad] }).ok, false);
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `node --test scripts/validate-arsenal.test.js`
Expected: FAIL (cannot find module)

- [ ] **Step 4: Write the validator**

```js
// scripts/validate-arsenal.js
const KINDS = ['ai-agent', 'agent-framework', 'tool', 'lab-dataset'];
const COV = ['covered', 'partial', 'tool-dep', 'not-covered'];
const AUT = ['L1', 'L2', 'L3', null];

function validateArsenal(data) {
  const errors = [];
  if (!Array.isArray(data.items)) return { ok: false, errors: ['items must be an array'] };
  for (const it of data.items) {
    const tag = it.id || it.repo || '<unknown>';
    if (!KINDS.includes(it.kind)) errors.push(`${tag}: bad kind ${it.kind}`);
    if (!AUT.includes(it.autonomy)) errors.push(`${tag}: bad autonomy ${it.autonomy}`);
    if (it.kind === 'tool' && it.autonomy !== null) errors.push(`${tag}: kind=tool must have autonomy null`);
    if (!Array.isArray(it.techniques)) { errors.push(`${tag}: techniques must be array`); continue; }
    for (const t of it.techniques) {
      if (!COV.includes(t.coverage)) errors.push(`${tag}/${t.id}: bad coverage ${t.coverage}`);
      if (!t.source || !t.source.tier || !t.source.ref) errors.push(`${tag}/${t.id}: missing source (honesty guard)`);
    }
  }
  return { ok: errors.length === 0, errors };
}

module.exports = { validateArsenal };

if (require.main === module) {
  const data = require('../app/public/arsenal.json');
  const r = validateArsenal(data);
  if (!r.ok) { console.error('INVALID:\n' + r.errors.join('\n')); process.exit(1); }
  console.log(`arsenal.json valid — ${data.items.length} items`);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test scripts/validate-arsenal.test.js`
Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add app/src/types/index.ts scripts/validate-arsenal.js scripts/validate-arsenal.test.js
git commit -m "feat(arsenal): types + validator with honesty guard"
```

---

### Task 4: Generalize derivations + arsenal hook

**Files:**
- Modify: `app/src/utils/attack.ts` (widen param types — no behavior change)
- Create: `app/src/hooks/useArsenal.ts`
- Create: `app/public/arsenal.json` (empty skeleton so the hook resolves)

**Interfaces:**
- Consumes: `ArsenalData`, existing `Tactic`
- Produces: `useArsenal() -> { arsenal: ArsenalData | null, loading, error }`; derivation fns now accept any `{ techniques: TechniqueMapping[] }`

- [ ] **Step 1: Widen derivation signatures**

In `app/src/utils/attack.ts`, add at top and replace `Agent` params with a structural type (Agent still satisfies it, so no caller breaks):

```ts
import type { Tactic, OverviewCell, CoverageLevel, TechniqueMapping } from '../types'

type HasTechniques = { techniques: TechniqueMapping[] }
// then change every `agent: Agent` param below to `agent: HasTechniques`
// and buildOverviewMatrix's `agents: Agent[]` to `agents: (HasTechniques & { id: string })[]`
```

- [ ] **Step 2: Run existing tests to confirm no regression**

Run (from `app/`): `npm run test:run`
Expected: existing `attack.test.ts` still PASS

- [ ] **Step 3: Create empty arsenal.json skeleton**

```json
{ "version": "0", "lastUpdated": "2026-07-07", "items": [] }
```

- [ ] **Step 4: Write the hook**

```ts
// app/src/hooks/useArsenal.ts
import { useState, useEffect } from 'react'
import type { ArsenalData } from '../types'

export function useArsenal() {
  const [arsenal, setArsenal] = useState<ArsenalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    fetch('/arsenal.json')
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<ArsenalData> })
      .then((d) => { setArsenal(d); setLoading(false) })
      .catch((e: Error) => { setError(e.message); setLoading(false) })
  }, [])
  return { arsenal, loading, error }
}
```

- [ ] **Step 5: Commit**

```bash
git add app/src/utils/attack.ts app/src/hooks/useArsenal.ts app/public/arsenal.json
git commit -m "feat(arsenal): generalize derivations + useArsenal hook"
```

---

### Task 5: Inventory-row derivations

**Files:**
- Create: `app/src/utils/arsenal.ts`
- Create: `app/src/utils/arsenal.test.ts`

**Interfaces:**
- Produces: `toRow(item, tactics) -> ArsenalRow` with `{ id, name, kind, category, stars, autonomy, language, tacticSpan, covered, partial, toolDep }`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { toRow } from './arsenal'
import type { ArsenalItem, Tactic } from '../types'

const tactics: Tactic[] = [
  { id: 'TA0043', name: 'Recon', shortname: 'reconnaissance', techniques: [{ id: 'T1595', name: 'Active Scanning', sub_techniques: [] }] },
  { id: 'TA0002', name: 'Execution', shortname: 'execution', techniques: [{ id: 'T1059', name: 'Cmd', sub_techniques: [] }] },
]
const item = {
  id: 'x', kind: 'tool', category: 'recon', name: 'X', stars: 3, autonomy: null, language: 'Go',
  techniques: [
    { id: 'T1595', coverage: 'tool-dep', notes: '', source: { tier: 'T2', ref: 'r' } },
    { id: 'T1059', coverage: 'covered', notes: '', source: { tier: 'T2', ref: 'r' } },
  ],
} as unknown as ArsenalItem

describe('toRow', () => {
  it('counts coverage + tactic span', () => {
    const row = toRow(item, tactics)
    expect(row.covered).toBe(1)
    expect(row.toolDep).toBe(1)
    expect(row.tacticSpan).toBe(2) // touches both tactics
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run (from `app/`): `npm run test:run -- arsenal`
Expected: FAIL (toRow not defined)

- [ ] **Step 3: Implement**

```ts
// app/src/utils/arsenal.ts
import type { ArsenalItem, Tactic, ItemKind } from '../types'
import { countCoveredInTactic, countPartialInTactic, countToolDepInTactic } from './attack'

export interface ArsenalRow {
  id: string; name: string; kind: ItemKind; category: string
  stars: number; autonomy: string; language: string
  tacticSpan: number; covered: number; partial: number; toolDep: number
}

export function toRow(item: ArsenalItem, tactics: Tactic[]): ArsenalRow {
  let covered = 0, partial = 0, toolDep = 0, tacticSpan = 0
  for (const t of tactics) {
    const c = countCoveredInTactic(item, t)
    const p = countPartialInTactic(item, t)
    const d = countToolDepInTactic(item, t)
    if (c + p + d > 0) tacticSpan++
    covered += c; partial += p; toolDep += d
  }
  return {
    id: item.id, name: item.name, kind: item.kind, category: item.category,
    stars: item.stars, autonomy: item.autonomy ?? '—', language: item.language ?? '—',
    tacticSpan, covered, partial, toolDep,
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run (from `app/`): `npm run test:run -- arsenal`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/src/utils/arsenal.ts app/src/utils/arsenal.test.ts
git commit -m "feat(arsenal): inventory-row derivations"
```

---

### Task 6: ArsenalPage shell + route + nav

**Files:**
- Create: `app/src/pages/ArsenalPage.tsx`
- Modify: `app/src/App.tsx` (add nav link + route)

**Interfaces:**
- Consumes: `useArsenal`, `useData` (for `attack.tactics`)
- Produces: `/arsenal` route rendering a view switcher (Inventory | Matrix)

- [ ] **Step 1: Create the page shell**

```tsx
// app/src/pages/ArsenalPage.tsx
import { useState } from 'react'
import { useArsenal } from '../hooks/useArsenal'
import type { Tactic } from '../types'
import { ArsenalTable } from '../components/ArsenalTable'
import { ArsenalMatrix } from '../components/ArsenalMatrix'

export function ArsenalPage({ tactics }: { tactics: Tactic[] }) {
  const { arsenal, loading, error } = useArsenal()
  const [view, setView] = useState<'table' | 'matrix'>('table')
  if (loading) return <div className="app-loading">Loading arsenal…</div>
  if (error || !arsenal) return <div className="app-error">Error: {error ?? 'no data'}</div>
  return (
    <div className="arsenal-page">
      <div className="arsenal-viewswitch">
        <button className={view === 'table' ? 'active' : ''} onClick={() => setView('table')}>Inventory</button>
        <button className={view === 'matrix' ? 'active' : ''} onClick={() => setView('matrix')}>Coverage Matrix</button>
      </div>
      {view === 'table'
        ? <ArsenalTable items={arsenal.items} tactics={tactics} />
        : <ArsenalMatrix items={arsenal.items} tactics={tactics} />}
    </div>
  )
}
```

- [ ] **Step 2: Wire route + nav in App.tsx**

Add import `import { ArsenalPage } from './pages/ArsenalPage'`, a topbar `NavLink to="/arsenal"` labelled `Starred Arsenal`, and inside `<Routes>`:

```tsx
<Route path="/arsenal" element={<ArsenalPage tactics={attack.tactics} />} />
```

- [ ] **Step 3: Verify build**

Run (from `app/`): `npm run build`
Expected: build succeeds (ArsenalTable/ArsenalMatrix must exist — do Tasks 7–8 first or stub them)

- [ ] **Step 4: Commit**

```bash
git add app/src/pages/ArsenalPage.tsx app/src/App.tsx
git commit -m "feat(arsenal): page shell + route + nav"
```

---

### Task 7: Inventory table (sort + filter)

**Files:**
- Create: `app/src/components/ArsenalTable.tsx`
- Create: `app/src/components/ArsenalTable.test.tsx`

**Interfaces:**
- Consumes: `ArsenalItem[]`, `Tactic[]`, `toRow`
- Produces: sortable/filterable table; row click → `/arsenal/:id`

- [ ] **Step 1: Write the failing render test**

```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import { ArsenalTable } from './ArsenalTable'
import type { ArsenalItem, Tactic } from '../types'

const tactics: Tactic[] = [{ id: 'TA0043', name: 'Recon', shortname: 'reconnaissance', techniques: [{ id: 'T1595', name: 'AS', sub_techniques: [] }] }]
const items = [{ id: 'nmap', name: 'nmap', kind: 'tool', category: 'recon', stars: 9, autonomy: null, language: 'C', techniques: [{ id: 'T1595', coverage: 'tool-dep', notes: '', source: { tier: 'T2', ref: 'r' } }] }] as unknown as ArsenalItem[]

describe('ArsenalTable', () => {
  it('renders a row per item', () => {
    render(<MemoryRouter><ArsenalTable items={items} tactics={tactics} /></MemoryRouter>)
    expect(screen.getByText('nmap')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run (from `app/`): `npm run test:run -- ArsenalTable`
Expected: FAIL (component not found)

- [ ] **Step 3: Implement (reuse `SortTh` pattern from existing components)**

```tsx
// app/src/components/ArsenalTable.tsx
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ArsenalItem, Tactic, ItemKind } from '../types'
import { toRow, type ArsenalRow } from '../utils/arsenal'

const KINDS: (ItemKind | 'all')[] = ['all', 'ai-agent', 'agent-framework', 'tool', 'lab-dataset']

export function ArsenalTable({ items, tactics }: { items: ArsenalItem[]; tactics: Tactic[] }) {
  const [kind, setKind] = useState<ItemKind | 'all'>('all')
  const [sortKey, setSortKey] = useState<keyof ArsenalRow>('stars')
  const rows = useMemo(() => {
    let r = items.map((it) => toRow(it, tactics))
    if (kind !== 'all') r = r.filter((x) => x.kind === kind)
    return r.sort((a, b) => (b[sortKey] > a[sortKey] ? 1 : -1))
  }, [items, tactics, kind, sortKey])
  return (
    <div className="arsenal-table-wrap">
      <div className="arsenal-filters">
        {KINDS.map((k) => (
          <button key={k} className={kind === k ? 'active' : ''} onClick={() => setKind(k)}>{k}</button>
        ))}
      </div>
      <table className="arsenal-table">
        <thead><tr>
          {(['name','kind','category','stars','tacticSpan','covered','partial','toolDep','autonomy','language'] as (keyof ArsenalRow)[]).map((k) => (
            <th key={k} onClick={() => setSortKey(k)} className={sortKey === k ? 'sorted' : ''}>{k}</th>
          ))}
        </tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td><Link to={`/arsenal/${row.id}`}>{row.name}</Link></td>
              <td>{row.kind}</td><td>{row.category}</td><td>{row.stars}</td>
              <td>{row.tacticSpan}</td><td>{row.covered}</td><td>{row.partial}</td><td>{row.toolDep}</td>
              <td>{row.autonomy}</td><td>{row.language}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 4: Run to verify it passes**

Run (from `app/`): `npm run test:run -- ArsenalTable`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/src/components/ArsenalTable.tsx app/src/components/ArsenalTable.test.tsx
git commit -m "feat(arsenal): inventory table with sort + kind filter"
```

---

### Task 8: Coverage matrix

**Files:**
- Create: `app/src/components/ArsenalMatrix.tsx`

**Interfaces:**
- Consumes: `ArsenalItem[]`, `Tactic[]`, `buildOverviewMatrix` (now generalized in Task 4)

- [ ] **Step 1: Implement (thin wrapper over generalized `buildOverviewMatrix`)**

```tsx
// app/src/components/ArsenalMatrix.tsx
import type { ArsenalItem, Tactic } from '../types'
import { buildOverviewMatrix } from '../utils/attack'

export function ArsenalMatrix({ items, tactics }: { items: ArsenalItem[]; tactics: Tactic[] }) {
  const cells = buildOverviewMatrix(items, tactics)
  const cell = (itemId: string, tacticId: string) =>
    cells.find((c) => c.agentId === itemId && c.tacticId === tacticId)
  return (
    <div className="arsenal-matrix-wrap">
      <table className="overview-matrix">
        <thead><tr><th>Item</th>{tactics.map((t) => <th key={t.id} title={t.name}>{t.shortname}</th>)}</tr></thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id}>
              <td>{it.name}</td>
              {tactics.map((t) => {
                const c = cell(it.id, t.id)
                const n = (c?.coveredCount ?? 0) + (c?.partialCount ?? 0) + (c?.toolDepCount ?? 0)
                return <td key={t.id} className={n > 0 ? `cov-${Math.min(n, 4)}` : ''}>{n || ''}</td>
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run (from `app/`): `npm run build`
Expected: succeeds

- [ ] **Step 3: Commit**

```bash
git add app/src/components/ArsenalMatrix.tsx
git commit -m "feat(arsenal): item x tactic coverage matrix"
```

---

### Task 9: Item detail view

**Files:**
- Create: `app/src/components/ArsenalItemDetail.tsx`
- Modify: `app/src/pages/ArsenalPage.tsx` (route `/arsenal/:id`) and `App.tsx` if needed

**Interfaces:**
- Consumes: `ArsenalItem`, `Tactic[]`, existing `TacticSection`/`TechniqueRow` rendering pattern

- [ ] **Step 1: Implement detail (reuse existing per-tactic technique layout from AgentPage)**

```tsx
// app/src/components/ArsenalItemDetail.tsx
import type { ArsenalItem, Tactic } from '../types'
import { getCoveredTechniquesInTactic } from '../utils/attack'

export function ArsenalItemDetail({ item, tactics }: { item: ArsenalItem; tactics: Tactic[] }) {
  return (
    <div className="arsenal-detail">
      <h2>{item.name} <a href={item.url} target="_blank" rel="noreferrer">↗</a></h2>
      <p className="arsenal-meta">{item.kind} · {item.category} · ★{item.stars} · {item.autonomy ?? 'tool'}</p>
      <p>{item.description}</p>
      {tactics.map((t) => {
        const techs = getCoveredTechniquesInTactic(item, t)
        if (techs.length === 0) return null
        return (
          <section key={t.id}>
            <h3>{t.name}</h3>
            <ul>{techs.map((x) => <li key={x.id}><code>{x.id}</code> {x.name} — <b>{x.coverage}</b> · {x.notes}</li>)}</ul>
          </section>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Add `/arsenal/:id` route** (in ArsenalPage or App): look up `arsenal.items.find(i => i.id === id)` via `useParams`, render `ArsenalItemDetail`.

- [ ] **Step 3: Verify build**

Run (from `app/`): `npm run build`
Expected: succeeds

- [ ] **Step 4: Commit**

```bash
git add app/src/components/ArsenalItemDetail.tsx app/src/pages/ArsenalPage.tsx app/src/App.tsx
git commit -m "feat(arsenal): per-item detail view"
```

---

### Task 10 (TEMPLATE, instantiated per confirmed category): Author coverage data

Run once per category bucket from the confirmed set (e.g. `ai-agent`, then `agent-framework`, then `tool`, then `lab-dataset`). Each instance is an independent, parallelizable authoring task.

**Files:**
- Modify: `app/public/arsenal.json` (append this category's items)
- (Seed first, once, via `scripts/seed-arsenal-from-tools.js` transforming `papers.json` `tools[]`)

**Process (per item in the category):**

1. Fetch evidence: `gh api repos/<repo>/readme -q .content | base64 -d` (README = T2) + topics. If a paper is linked, note it (T1-eligible).
2. Map behaviours → ATT&CK techniques (sub-technique preferred when evidence is specific).
3. Apply the rubric decision flow:
   - no T1–T3 evidence for a technique → omit or `not-covered`
   - pure tool executes the technique, no item-specific reasoning → `tool-dep`
   - README documents autonomous multi-step use → `covered`/`partial` (T2)
4. Write the item; every technique gets `source {tier, ref}`.
5. Set `autonomy` (`null` for `kind=tool`), `category`, `description` (functionality focus).

**Example authored item (the concrete target shape):**

```json
{
  "id": "caldera", "repo": "mitre/caldera", "name": "CALDERA",
  "url": "https://github.com/mitre/caldera", "stars": 5600, "language": "Python",
  "kind": "agent-framework", "category": "adversary-emulation",
  "description": "ATT&CK-based automated adversary emulation; plans and runs ability chains via agents.",
  "topics": ["att&ck", "security", "emulation"], "autonomy": "L2", "has_paper": false,
  "techniques": [
    { "id": "T1059", "coverage": "covered", "notes": "Planner sequences command-execution abilities autonomously toward an objective.",
      "source": { "tier": "T2", "ref": "github.com/mitre/caldera README — Abilities/Planners" } }
  ],
  "benchmark": null
}
```

- [ ] **Step: After each category batch, validate**

Run: `node scripts/validate-arsenal.js`
Expected: `arsenal.json valid — N items` (exit 0). Fix any honesty-guard error before committing.

- [ ] **Step: Commit the batch**

```bash
git add app/public/arsenal.json
git commit -m "data(arsenal): coverage for <category> batch"
```

---

# PHASE C — Finalize

### Task 11: Build, verify, deploy

- [ ] **Step 1: Full test + build**

Run (from `app/`): `npm run test:run && npm run build`
Expected: all tests PASS, build succeeds

- [ ] **Step 2: Validate data**

Run: `node scripts/validate-arsenal.js`
Expected: exit 0

- [ ] **Step 3: Manual smoke** (`npm run dev`, open `/arsenal`, check table sort/filter, matrix, one detail page)

- [ ] **Step 4: Merge + push** (CF Pages auto-deploys `app/` on push to the deploy branch)

```bash
git checkout master && git merge --no-ff feat/starred-arsenal
git push
```

---

### Task 12: Vault sync (per vault CLAUDE.md)

**Files (in the notes vault, not this repo):**
- Append: `log.md`
- Create: `wiki/Red-Team/Starred-Arsenal.md`

- [ ] **Step 1: Append to `log.md`**

```
## [2026-07-07] ingest | Starred Arsenal coverage
```

- [ ] **Step 2: Create `wiki/Red-Team/Starred-Arsenal.md`** — frontmatter (`tags:[wiki]`, `category:Red-Team`, `updated:2026-07-07`) + summary of counts per kind/tactic + link `[[ATT&CK-Coverage-Rubric]]` and `[[Tools]]`. Update `index.md`.

---

## Self-Review

**Spec coverage:** fetch (T1) ✓, classify/triage + checkpoint (T2 + gate) ✓, schema+honesty guard (T3) ✓, 19-tool seed (T4/T10) ✓, coverage authoring full rubric (T10) ✓, 3 UI views table/matrix/detail (T7/T8/T9) ✓, comparison via shared ATT&CK backbone (T8 matrix) ✓, vault sync (T12) ✓.

**Placeholder scan:** every code step has runnable content; Task 10 is an explicit per-category template with a concrete example item, not a placeholder.

**Type consistency:** `ArsenalItem.techniques` reuses `TechniqueMapping`; `toRow` consumes it; `buildOverviewMatrix`/`countXInTactic` widened to `HasTechniques` in Task 4 before Tasks 5/8 rely on it; coverage enum + kinds identical across validator (JS) and types (TS).
