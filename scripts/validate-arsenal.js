// Schema + honesty-guard validator for app/public/arsenal.json.
// Run: node scripts/validate-arsenal.js   (exit 1 on any error)
const KINDS = ['ai-agent', 'agent-framework', 'tool', 'lab-dataset'];
const COV = ['covered', 'partial', 'tool-dep', 'not-covered'];
const AUT = ['L1', 'L2', 'L3', null];

function validateArsenal(data) {
  const errors = [];
  if (!data || !Array.isArray(data.items)) return { ok: false, errors: ['items must be an array'] };
  const seen = new Set();
  for (const it of data.items) {
    const tag = it.id || it.repo || '<unknown>';
    if (seen.has(it.id)) errors.push(`${tag}: duplicate id`);
    seen.add(it.id);
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
