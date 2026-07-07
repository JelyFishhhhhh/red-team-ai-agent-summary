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
