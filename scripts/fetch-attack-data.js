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
