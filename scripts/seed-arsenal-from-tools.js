// Seed app/public/arsenal.json from the 19 curated tools in papers.json.
// Tools are tool-dep by rubric definition → every technique gets coverage:"tool-dep".
// Run: node scripts/seed-arsenal-from-tools.js
const fs = require('fs');
const path = require('path');
const papers = require('../app/public/papers.json');

const catByType = { recon: 'recon', exploitation: 'exploitation', 'post-exploit': 'post-exploitation' };

const items = papers.tools.map((t) => ({
  id: t.id,
  repo: '',
  name: t.name,
  url: '',
  stars: 0,
  language: null,
  kind: 'tool',
  category: catByType[t.type] || t.type || 'tool',
  description: t.notes || '',
  topics: [],
  autonomy: null,
  has_paper: false,
  techniques: (t.techniques || []).map((tech) => ({
    id: tech.id,
    coverage: 'tool-dep',
    notes: `${t.name} executes ${tech.name}; agent-agnostic tool logic.`,
    source: { tier: 'T2', ref: `papers.json tools[] curated — ${t.name}` },
  })),
  benchmark: null,
}));

const out = { version: '1', lastUpdated: new Date().toISOString().slice(0, 10), items };
const OUT = path.join(__dirname, '..', 'app', 'public', 'arsenal.json');
fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log(`Seeded ${items.length} tool items → ${OUT}`);
