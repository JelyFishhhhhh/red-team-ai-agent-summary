#!/usr/bin/env node
/**
 * ATT&CK Coverage Analysis
 * Generates Table A (Tactic × Agent matrix) and Table B (Technique depth per Tactic)
 * from papers.json
 *
 * Usage:
 *   node scripts/coverage-analysis.js
 *   node scripts/coverage-analysis.js --csv      # also export CSV files
 *   node scripts/coverage-analysis.js --json     # also export JSON summary
 */

const fs = require('fs');
const path = require('path');

// ─── ATT&CK v16 Enterprise: technique count per Tactic ───────────────────────
const TACTIC_META = {
  'TA0043': { name: 'Reconnaissance',        total: 10, order: 1  },
  'TA0042': { name: 'Resource Development',  total: 8,  order: 2  },
  'TA0001': { name: 'Initial Access',        total: 10, order: 3  },
  'TA0002': { name: 'Execution',             total: 14, order: 4  },
  'TA0003': { name: 'Persistence',           total: 19, order: 5  },
  'TA0004': { name: 'Privilege Escalation',  total: 14, order: 6  },
  'TA0005': { name: 'Defense Evasion',       total: 43, order: 7  },
  'TA0006': { name: 'Credential Access',     total: 17, order: 8  },
  'TA0007': { name: 'Discovery',             total: 32, order: 9  },
  'TA0008': { name: 'Lateral Movement',      total: 9,  order: 10 },
  'TA0009': { name: 'Collection',            total: 17, order: 11 },
  'TA0010': { name: 'Exfiltration',          total: 9,  order: 12 },
  'TA0011': { name: 'Command and Control',   total: 18, order: 13 },
  'TA0040': { name: 'Impact',               total: 14, order: 14 },
};

// ─── Technique → Tactic mapping (parent T-ID → Tactic ID) ────────────────────
// Sub-techniques (T1234.001) inherit parent's tactic.
const TECHNIQUE_TACTIC = {
  // TA0043 Reconnaissance
  T1595: 'TA0043', T1590: 'TA0043', T1589: 'TA0043', T1592: 'TA0043',
  T1593: 'TA0043', T1596: 'TA0043', T1597: 'TA0043', T1598: 'TA0043',
  T1591: 'TA0043', T1594: 'TA0043',

  // TA0042 Resource Development
  T1583: 'TA0042', T1584: 'TA0042', T1585: 'TA0042', T1586: 'TA0042',
  T1587: 'TA0042', T1588: 'TA0042', T1608: 'TA0042', T1650: 'TA0042',

  // TA0001 Initial Access
  T1189: 'TA0001', T1190: 'TA0001', T1133: 'TA0001', T1200: 'TA0001',
  T1566: 'TA0001', T1091: 'TA0001', T1195: 'TA0001', T1199: 'TA0001',
  T1078: 'TA0001', T1659: 'TA0001',

  // TA0002 Execution
  T1059: 'TA0002', T1609: 'TA0002', T1610: 'TA0002', T1203: 'TA0002',
  T1559: 'TA0002', T1106: 'TA0002', T1053: 'TA0002', T1129: 'TA0002',
  T1072: 'TA0002', T1569: 'TA0002', T1204: 'TA0002', T1047: 'TA0002',
  T1648: 'TA0002', T1651: 'TA0002',

  // TA0003 Persistence
  T1098: 'TA0003', T1197: 'TA0003', T1547: 'TA0003', T1037: 'TA0003',
  T1176: 'TA0003', T1554: 'TA0003', T1136: 'TA0003', T1543: 'TA0003',
  T1546: 'TA0003', T1133: 'TA0003', T1574: 'TA0003', T1525: 'TA0003',
  T1556: 'TA0003', T1137: 'TA0003', T1542: 'TA0003', T1053: 'TA0003',
  T1505: 'TA0003', T1078: 'TA0003', T1205: 'TA0003', T1491: 'TA0003',

  // TA0004 Privilege Escalation
  T1548: 'TA0004', T1134: 'TA0004', T1547: 'TA0004', T1037: 'TA0004',
  T1543: 'TA0004', T1484: 'TA0004', T1546: 'TA0004', T1068: 'TA0004',
  T1574: 'TA0004', T1055: 'TA0004', T1053: 'TA0004', T1078: 'TA0004',
  T1098: 'TA0004', T1611: 'TA0004',

  // TA0005 Defense Evasion
  T1548: 'TA0005', T1134: 'TA0005', T1197: 'TA0005', T1622: 'TA0005',
  T1140: 'TA0005', T1006: 'TA0005', T1484: 'TA0005', T1480: 'TA0005',
  T1211: 'TA0005', T1222: 'TA0005', T1564: 'TA0005', T1574: 'TA0005',
  T1562: 'TA0005', T1070: 'TA0005', T1202: 'TA0005', T1036: 'TA0005',
  T1556: 'TA0005', T1578: 'TA0005', T1112: 'TA0005', T1601: 'TA0005',
  T1599: 'TA0005', T1027: 'TA0005', T1542: 'TA0005', T1055: 'TA0005',
  T1207: 'TA0005', T1014: 'TA0005', T1218: 'TA0005', T1216: 'TA0005',
  T1553: 'TA0005', T1221: 'TA0005', T1205: 'TA0005', T1127: 'TA0005',
  T1535: 'TA0005', T1550: 'TA0005', T1078: 'TA0005', T1497: 'TA0005',
  T1600: 'TA0005', T1220: 'TA0005', T1102: 'TA0005', T1047: 'TA0005',
  T1230: 'TA0005', T1006: 'TA0005', T1612: 'TA0005',

  // TA0006 Credential Access
  T1110: 'TA0006', T1555: 'TA0006', T1212: 'TA0006', T1187: 'TA0006',
  T1606: 'TA0006', T1056: 'TA0006', T1557: 'TA0006', T1556: 'TA0006',
  T1111: 'TA0006', T1621: 'TA0006', T1040: 'TA0006', T1003: 'TA0006',
  T1528: 'TA0006', T1649: 'TA0006', T1558: 'TA0006', T1539: 'TA0006',
  T1552: 'TA0006',

  // TA0007 Discovery
  T1087: 'TA0007', T1010: 'TA0007', T1217: 'TA0007', T1580: 'TA0007',
  T1538: 'TA0007', T1526: 'TA0007', T1619: 'TA0007', T1613: 'TA0007',
  T1622: 'TA0007', T1482: 'TA0007', T1083: 'TA0007', T1615: 'TA0007',
  T1592: 'TA0007', T1046: 'TA0007', T1135: 'TA0007', T1040: 'TA0007',
  T1201: 'TA0007', T1120: 'TA0007', T1069: 'TA0007', T1057: 'TA0007',
  T1012: 'TA0007', T1018: 'TA0007', T1518: 'TA0007', T1082: 'TA0007',
  T1614: 'TA0007', T1016: 'TA0007', T1049: 'TA0007', T1033: 'TA0007',
  T1007: 'TA0007', T1124: 'TA0007', T1497: 'TA0007', T1047: 'TA0007',

  // TA0008 Lateral Movement
  T1210: 'TA0008', T1534: 'TA0008', T1570: 'TA0008', T1563: 'TA0008',
  T1021: 'TA0008', T1091: 'TA0008', T1072: 'TA0008', T1080: 'TA0008',
  T1550: 'TA0008',

  // TA0009 Collection
  T1560: 'TA0009', T1123: 'TA0009', T1119: 'TA0009', T1185: 'TA0009',
  T1115: 'TA0009', T1530: 'TA0009', T1602: 'TA0009', T1213: 'TA0009',
  T1005: 'TA0009', T1039: 'TA0009', T1025: 'TA0009', T1074: 'TA0009',
  T1114: 'TA0009', T1113: 'TA0009', T1125: 'TA0009', T1056: 'TA0009',
  T1557: 'TA0009',

  // TA0010 Exfiltration
  T1020: 'TA0010', T1030: 'TA0010', T1048: 'TA0010', T1041: 'TA0010',
  T1011: 'TA0010', T1052: 'TA0010', T1567: 'TA0010', T1029: 'TA0010',
  T1537: 'TA0010',

  // TA0011 Command and Control
  T1071: 'TA0011', T1092: 'TA0011', T1659: 'TA0011', T1132: 'TA0011',
  T1001: 'TA0011', T1568: 'TA0011', T1573: 'TA0011', T1008: 'TA0011',
  T1105: 'TA0011', T1104: 'TA0011', T1095: 'TA0011', T1571: 'TA0011',
  T1572: 'TA0011', T1090: 'TA0011', T1219: 'TA0011', T1205: 'TA0011',
  T1102: 'TA0011', T1647: 'TA0011',

  // TA0040 Impact
  T1531: 'TA0040', T1485: 'TA0040', T1486: 'TA0040', T1565: 'TA0040',
  T1491: 'TA0040', T1561: 'TA0040', T1499: 'TA0040', T1495: 'TA0040',
  T1490: 'TA0040', T1498: 'TA0040', T1496: 'TA0040', T1489: 'TA0040',
  T1529: 'TA0040', T1657: 'TA0040',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Get parent T-ID: T1021.004 → T1021 */
function parentId(tid) {
  return tid.includes('.') ? tid.split('.')[0] : tid;
}

/** Resolve tactic for a technique ID (handles sub-techniques) */
function getTactic(tid) {
  return TECHNIQUE_TACTIC[parentId(tid)] || null;
}

/** Coverage symbol for table cells */
function symbol(coverage) {
  if (coverage === 'covered')     return '✅';
  if (coverage === 'partial')     return '⚠️';
  if (coverage === 'not-covered') return '❌';
  return '—';
}

/** Coverage abbreviation for CSV */
function abbrev(coverage) {
  if (coverage === 'covered')     return 'C';
  if (coverage === 'partial')     return 'P';
  if (coverage === 'not-covered') return 'N';
  return '';
}

// ─── Load data ────────────────────────────────────────────────────────────────

const dataPath = path.join(__dirname, '../app/public/papers.json');
const { agents } = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

const allTacticIds = Object.keys(TACTIC_META).sort(
  (a, b) => TACTIC_META[a].order - TACTIC_META[b].order
);

// ─── Build coverage structures ────────────────────────────────────────────────

/**
 * agentTacticCoverage[agentId][tacticId] = 'covered' | 'partial' | 'not-covered'
 * Rule: if any technique in the tactic is 'covered' → tactic = covered
 *       if any is 'partial' (and none covered) → tactic = partial
 *       otherwise → not-covered
 */
const agentTacticCoverage = {};
/** agentTacticTechniques[agentId][tacticId] = Set of T-IDs executed */
const agentTacticTechniques = {};

agents.forEach(agent => {
  agentTacticCoverage[agent.id] = {};
  agentTacticTechniques[agent.id] = {};

  allTacticIds.forEach(tid => {
    agentTacticCoverage[agent.id][tid] = 'not-covered';
    agentTacticTechniques[agent.id][tid] = new Set();
  });

  agent.techniques.forEach(t => {
    const tactic = getTactic(t.id);
    if (!tactic) return;

    const parent = parentId(t.id);
    agentTacticTechniques[agent.id][tactic].add(parent);

    const cur = agentTacticCoverage[agent.id][tactic];
    if (t.coverage === 'covered') {
      agentTacticCoverage[agent.id][tactic] = 'covered';
    } else if (t.coverage === 'partial' && cur === 'not-covered') {
      agentTacticCoverage[agent.id][tactic] = 'partial';
    }
  });
});

/**
 * allTechniquesCovered[tacticId] = Set of unique parent T-IDs covered (by any agent, covered or partial)
 */
const allTechniquesCovered = {};
allTacticIds.forEach(tid => { allTechniquesCovered[tid] = new Set(); });

agents.forEach(agent => {
  agent.techniques.forEach(t => {
    const tactic = getTactic(t.id);
    if (!tactic) return;
    if (t.coverage !== 'not-covered') {
      allTechniquesCovered[tactic].add(parentId(t.id));
    }
  });
});

// ─── TABLE A: Tactic × Agent matrix ──────────────────────────────────────────

console.log('\n' + '═'.repeat(120));
console.log('TABLE A — Tactic × Agent Coverage Matrix');
console.log('Legend: ✅ covered  ⚠️ partial  ❌ not-covered  — not mapped in papers.json');
console.log('═'.repeat(120));

// Header row
const tacticLabels = allTacticIds.map(tid => `${tid}\n${TACTIC_META[tid].name}`);
const agentIds = agents.map(a => a.id);

// Print in chunks of 8 agents to fit terminal
const CHUNK = 8;
for (let i = 0; i < agentIds.length; i += CHUNK) {
  const chunk = agentIds.slice(i, i + CHUNK);

  // Header
  const header = 'Tactic'.padEnd(34) + chunk.map(id => id.substring(0,14).padEnd(16)).join('');
  console.log('\n' + header);
  console.log('-'.repeat(34 + chunk.length * 16));

  allTacticIds.forEach(tacticId => {
    const meta = TACTIC_META[tacticId];
    const label = `${tacticId} ${meta.name}`.padEnd(33);
    const cells = chunk.map(agentId => {
      const cov = agentTacticCoverage[agentId][tacticId];
      return symbol(cov).padEnd(16);
    }).join('');
    console.log(label + ' ' + cells);
  });
}

// ─── TABLE B: Technique Depth per Tactic ─────────────────────────────────────

console.log('\n\n' + '═'.repeat(90));
console.log('TABLE B — Technique Depth per Tactic (coverage across all agents combined)');
console.log('═'.repeat(90));

const headerB = 'Tactic'.padEnd(35) +
  'Covered T-IDs'.padEnd(18) +
  'ATT&CK v16 Total'.padEnd(18) +
  'Depth %'.padEnd(10) +
  'Gap'.padEnd(8) +
  'Status';
console.log(headerB);
console.log('-'.repeat(90));

const summaryB = [];
allTacticIds.forEach(tid => {
  const meta = TACTIC_META[tid];
  const coveredSet = allTechniquesCovered[tid];
  const coveredCount = coveredSet.size;
  const total = meta.total;
  const pct = total > 0 ? ((coveredCount / total) * 100).toFixed(1) : '0.0';
  const gap = total - coveredCount;

  const status = coveredCount === 0
    ? '❌ UNCOVERED'
    : parseFloat(pct) < 20
    ? '🔴 Critical gap'
    : parseFloat(pct) < 50
    ? '🟡 Significant gap'
    : parseFloat(pct) < 80
    ? '🟠 Partial'
    : '🟢 Good';

  const label = `${tid} ${meta.name}`.padEnd(34);
  const covList = coveredCount > 0 ? `${coveredCount} [${[...coveredSet].sort().join(', ')}]` : '0';

  // Short display
  const line = label + ' ' +
    String(coveredCount).padEnd(17) +
    String(total).padEnd(17) +
    `${pct}%`.padEnd(9) +
    String(gap).padEnd(7) +
    status;
  console.log(line);

  if (coveredCount > 0 && coveredCount <= 10) {
    console.log(' '.repeat(35) + `↳ ${[...coveredSet].sort().join(', ')}`);
  }

  summaryB.push({ tacticId: tid, name: meta.name, coveredCount, total, pct: parseFloat(pct), gap, coveredTids: [...coveredSet].sort() });
});

// ─── TABLE B2: Per-best-agent technique depth ─────────────────────────────────

console.log('\n\n' + '═'.repeat(90));
console.log('TABLE B2 — Best Agent per Tactic (deepest single-agent Technique coverage)');
console.log('═'.repeat(90));

const headerB2 = 'Tactic'.padEnd(35) + 'Best Agent'.padEnd(20) + '# Techniques'.padEnd(15) + 'T-IDs';
console.log(headerB2);
console.log('-'.repeat(90));

allTacticIds.forEach(tid => {
  let bestAgent = null;
  let bestCount = 0;
  let bestTids = new Set();

  agents.forEach(agent => {
    const tids = agentTacticTechniques[agent.id][tid];
    if (tids.size > bestCount) {
      bestCount = tids.size;
      bestAgent = agent.id;
      bestTids = tids;
    }
  });

  const meta = TACTIC_META[tid];
  const label = `${tid} ${meta.name}`.padEnd(34);
  if (bestCount === 0) {
    console.log(label + ' ' + '—'.padEnd(20) + '0');
  } else {
    const tidStr = [...bestTids].sort().join(', ');
    console.log(label + ' ' + bestAgent.padEnd(20) + String(bestCount).padEnd(15) + tidStr);
  }
});

// ─── SUMMARY ─────────────────────────────────────────────────────────────────

console.log('\n\n' + '═'.repeat(60));
console.log('SUMMARY');
console.log('═'.repeat(60));

const uncovered = summaryB.filter(r => r.coveredCount === 0);
const criticalGap = summaryB.filter(r => r.coveredCount > 0 && r.pct < 20);
const totalAgents = agents.length;
const maxTactics = Math.max(...Object.values(agentTacticCoverage).map(
  tacMap => Object.values(tacMap).filter(v => v !== 'not-covered').length
));

console.log(`Total agents in corpus: ${totalAgents}`);
console.log(`Total tactics in ATT&CK v16: ${allTacticIds.length}`);
console.log(`Tactics with ZERO agent coverage: ${uncovered.length} → ${uncovered.map(r => r.tacticId).join(', ')}`);
console.log(`Tactics with <20% technique depth: ${criticalGap.length}`);
console.log(`Best single-agent tactic breadth: ${maxTactics} tactics (Decepticon)`);

const totalCoveredAll = summaryB.reduce((s, r) => s + r.coveredCount, 0);
const totalAll = summaryB.reduce((s, r) => s + r.total, 0);
console.log(`\nOverall technique coverage (all agents combined):`);
console.log(`  Covered: ${totalCoveredAll} / ${totalAll} unique techniques = ${((totalCoveredAll/totalAll)*100).toFixed(1)}%`);
console.log(`  Missing: ${totalAll - totalCoveredAll} techniques across all tactics`);

// ─── CSV export ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const exportCsv = args.includes('--csv');
const exportJson = args.includes('--json');

if (exportCsv) {
  const outDir = path.join(__dirname, '../docs/coverage-analysis');
  fs.mkdirSync(outDir, { recursive: true });

  // Table A CSV
  const csvALines = [
    ['Agent', ...allTacticIds.map(tid => `${tid} ${TACTIC_META[tid].name}`)].join(',')
  ];
  agents.forEach(agent => {
    const row = [agent.id, ...allTacticIds.map(tid => abbrev(agentTacticCoverage[agent.id][tid]))];
    csvALines.push(row.join(','));
  });
  fs.writeFileSync(path.join(outDir, 'table-a-tactic-agent.csv'), csvALines.join('\n'));
  console.log('\n✅ CSV: docs/coverage-analysis/table-a-tactic-agent.csv');

  // Table B CSV
  const csvBLines = [
    ['Tactic ID', 'Tactic Name', 'Covered T-IDs', 'ATT&CK v16 Total', 'Depth %', 'Gap', 'Covered T-ID List'].join(',')
  ];
  summaryB.forEach(r => {
    csvBLines.push([
      r.tacticId, r.name, r.coveredCount, r.total, r.pct, r.gap,
      `"${r.coveredTids.join('; ')}"`
    ].join(','));
  });
  fs.writeFileSync(path.join(outDir, 'table-b-technique-depth.csv'), csvBLines.join('\n'));
  console.log('✅ CSV: docs/coverage-analysis/table-b-technique-depth.csv');

  // Table A transposed: Tactic × Agent (for Excel pivot)
  const csvAPivotLines = [
    ['Tactic ID', 'Tactic Name', 'ATT&CK Total', ...agents.map(a => a.id)].join(',')
  ];
  allTacticIds.forEach(tid => {
    const row = [
      tid,
      TACTIC_META[tid].name,
      TACTIC_META[tid].total,
      ...agents.map(agent => abbrev(agentTacticCoverage[agent.id][tid]))
    ];
    csvAPivotLines.push(row.join(','));
  });
  fs.writeFileSync(path.join(outDir, 'table-a-pivot.csv'), csvAPivotLines.join('\n'));
  console.log('✅ CSV: docs/coverage-analysis/table-a-pivot.csv (tactic × agent, Excel-friendly)');
}

if (exportJson) {
  const outDir = path.join(__dirname, '../docs/coverage-analysis');
  fs.mkdirSync(outDir, { recursive: true });

  const jsonOut = {
    generated: new Date().toISOString().split('T')[0],
    totalAgents: agents.length,
    totalTactics: allTacticIds.length,
    tacticSummary: summaryB,
    agentTacticMatrix: Object.fromEntries(
      agents.map(a => [a.id, Object.fromEntries(
        allTacticIds.map(tid => [tid, {
          coverage: agentTacticCoverage[a.id][tid],
          techniques: [...agentTacticTechniques[a.id][tid]].sort()
        }])
      )])
    )
  };
  fs.writeFileSync(
    path.join(outDir, 'coverage-summary.json'),
    JSON.stringify(jsonOut, null, 2)
  );
  console.log('✅ JSON: docs/coverage-analysis/coverage-summary.json');
}

console.log('\nDone. Run with --csv or --json for file exports.\n');
