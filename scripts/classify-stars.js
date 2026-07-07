// Classify fetched stars → triage JSON + human-readable markdown table.
// Run: node scripts/classify-stars.js
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
const md = `# Starred Arsenal — Triage (${new Date().toISOString().slice(0, 10)})\n\n` +
  `Total: ${scored.length} | relevant: ${scored.filter((s) => s.relevant === true).length} | ` +
  `ambiguous: ${scored.filter((s) => s.relevant === null).length} | excluded: ${scored.filter((s) => s.relevant === false).length}\n\n` +
  `| repo | kind | keep | stars | description |\n|---|---|---|---|---|\n${rows}\n`;
const outMd = path.join(__dirname, '..', 'docs', 'coverage-analysis', 'arsenal-triage.md');
fs.writeFileSync(outMd, md);
console.log(`Triage written. Review: ${outMd}`);
