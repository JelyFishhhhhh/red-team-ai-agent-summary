#!/usr/bin/env node
// Fetch all of the authenticated user's GitHub stars via gh CLI.
// Run: node scripts/fetch-stars.js
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'data', 'arsenal.raw.json');
fs.mkdirSync(path.dirname(OUT), { recursive: true });

// gh paginates; -q emits one JSON object per repo (newline-delimited across pages).
const raw = execSync(
  `gh api user/starred --paginate ` +
  `-q '.[] | {repo: .full_name, name: .name, url: .html_url, ` +
  `description: .description, stars: .stargazers_count, ` +
  `language: .language, topics: .topics}'`,
  { maxBuffer: 64 * 1024 * 1024 }
).toString();

const items = raw.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
fs.writeFileSync(OUT, JSON.stringify(items, null, 2));
console.log(`Wrote ${items.length} starred repos to ${OUT}`);
