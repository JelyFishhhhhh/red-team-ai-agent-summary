// Merge authored fragments into app/public/arsenal.json.
// Base = 19-tool seed (re-derived from papers.json); adds any scripts/data/arsenal.*.json fragments.
// Run: node scripts/seed-arsenal-from-tools.js && node scripts/merge-arsenal.js
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'app', 'public', 'arsenal.json');
const base = require(OUT); // seed (tools) already written by seed script
const byId = new Map(base.items.map((i) => [i.id, i]));

// Authored coverage fragments live in a COMMITTED dir (not the gitignored scripts/data/),
// because their content is hand/agent-authored from READMEs, not mechanically regenerable.
const fragDir = path.join(__dirname, 'arsenal-fragments');
const fragments = fs.existsSync(fragDir)
  ? fs.readdirSync(fragDir).filter((f) => f.endsWith('.json'))
  : [];

let added = 0;
for (const f of fragments) {
  const items = require(path.join(fragDir, f));
  for (const it of items) {
    if (byId.has(it.id)) continue; // seed/first-fragment wins
    byId.set(it.id, it);
    added++;
  }
  console.log(`+ ${f}: ${items.length} items`);
}

const merged = { version: '1', lastUpdated: new Date().toISOString().slice(0, 10), items: [...byId.values()] };
fs.writeFileSync(OUT, JSON.stringify(merged, null, 2));
console.log(`Merged → ${merged.items.length} items (${added} new from fragments)`);
