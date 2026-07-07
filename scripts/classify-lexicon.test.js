const { test } = require('node:test');
const assert = require('node:assert');
const { classify } = require('./classify-lexicon');

test('LLM pentest agent -> ai-agent, relevant', () => {
  const r = classify({ name: 'PentestGPT', description: 'LLM automated penetration testing', topics: ['llm', 'pentest'], language: 'Python' });
  assert.equal(r.kind, 'ai-agent');
  assert.equal(r.relevant, true);
});

test('adversary emulation platform -> agent-framework', () => {
  const r = classify({ name: 'caldera', description: 'Automated adversary emulation platform', topics: ['att&ck', 'security'], language: 'Python' });
  assert.equal(r.kind, 'agent-framework');
  assert.equal(r.relevant, true);
});

test('classic offensive tool -> tool', () => {
  const r = classify({ name: 'nuclei', description: 'Fast vulnerability scanner', topics: ['security', 'pentest'], language: 'Go' });
  assert.equal(r.kind, 'tool');
  assert.equal(r.relevant, true);
});

test('unrelated repo -> excluded, not relevant', () => {
  const r = classify({ name: 'my-blog', description: 'Personal blog built with Astro', topics: ['blog'], language: 'TypeScript' });
  assert.equal(r.kind, 'excluded');
  assert.equal(r.relevant, false);
});
