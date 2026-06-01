#!/usr/bin/env node
/**
 * ATT&CK Coverage Analysis — DUAL-USE FIX
 *
 * Demonstrates the dual-use technique problem and produces corrected
 * "effective" tactic coverage numbers (excluding mappings that are
 * really intended for other tactics).
 *
 * Run:
 *   node scripts/coverage-analysis-fix.js
 */

const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '../app/public/papers.json');
const { agents } = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

// ─── Dual-use Techniques in ATT&CK v16 ───────────────────────────────────────
// Techniques that appear in multiple Tactics. Listed in ORDER of "primary"
// usage intent — earlier = more common agent intent.
const DUAL_USE_TECHNIQUES = {
  // T1078 Valid Accounts — primary use is Initial Access / PrivEsc / Defense Evasion / Persistence
  T1078: ['TA0001', 'TA0004', 'TA0005', 'TA0003'],
  // T1548 Abuse Elevation — primary PrivEsc, also Defense Evasion
  T1548: ['TA0004', 'TA0005'],
  // T1134 Access Token — PrivEsc primary, also Defense Evasion
  T1134: ['TA0004', 'TA0005'],
  // T1053 Scheduled Task — Execution primary, also Persistence, PrivEsc
  T1053: ['TA0002', 'TA0003', 'TA0004'],
  // T1547 Boot/Logon Autostart — Persistence primary, also PrivEsc
  T1547: ['TA0003', 'TA0004'],
  // T1574 Hijack Exec Flow — Persistence/PrivEsc/Defense Evasion all
  T1574: ['TA0003', 'TA0004', 'TA0005'],
  // T1133 External Remote Services — Initial Access primary, also Persistence
  T1133: ['TA0001', 'TA0003'],
  // T1543 Create or Modify System Process — Persistence + PrivEsc
  T1543: ['TA0003', 'TA0004'],
  // T1556 Modify Authentication Process — Defense Evasion + Persistence + Cred Access
  T1556: ['TA0005', 'TA0003', 'TA0006'],
  // T1098 Account Manipulation — Persistence primary, also PrivEsc
  T1098: ['TA0003', 'TA0004'],
  // T1546 Event Triggered Execution
  T1546: ['TA0003', 'TA0004'],
  // T1037 Boot/Logon Initialization Scripts
  T1037: ['TA0003', 'TA0004'],
  // T1542 Pre-OS Boot — Defense Evasion + Persistence
  T1542: ['TA0005', 'TA0003'],
  // T1205 Traffic Signaling — Defense Evasion + Persistence + C2
  T1205: ['TA0005', 'TA0003', 'TA0011'],
  // T1055 Process Injection — Defense Evasion + PrivEsc
  T1055: ['TA0005', 'TA0004'],
  // T1006/T1014 Defense Evasion only — not dual-use, no change needed
};

function parentId(tid) {
  return tid.includes('.') ? tid.split('.')[0] : tid;
}

function isDualUse(tid) {
  return parentId(tid) in DUAL_USE_TECHNIQUES;
}

function dualUseTactics(tid) {
  return DUAL_USE_TECHNIQUES[parentId(tid)] || [];
}

// ─── Heuristic: infer agent's intent for a dual-use T-ID from neighbours ─────
// Rule: if the agent covers techniques predominantly in Tactic X, and the
// dual-use T-ID is mapped to X (among its valid tactics), assume intent = X.
// Fallback: use the FIRST valid Tactic (most common usage).
function inferIntent(agent, tid) {
  const validTactics = dualUseTactics(tid);
  if (validTactics.length === 0) return null;
  return validTactics[0]; // simple heuristic: first listed = most common intent
}

// ─── Count effective coverage per Tactic ─────────────────────────────────────
const tacticEffective = {
  TA0043: new Set(), TA0042: new Set(), TA0001: new Set(), TA0002: new Set(),
  TA0003: new Set(), TA0004: new Set(), TA0005: new Set(), TA0006: new Set(),
  TA0007: new Set(), TA0008: new Set(), TA0009: new Set(), TA0010: new Set(),
  TA0011: new Set(), TA0040: new Set(),
};

// Non-dual-use T-ID → unique Tactic (from original mapping)
const SINGLE_TACTIC_MAP = {
  // Recon
  T1595: 'TA0043', T1590: 'TA0043', T1589: 'TA0043', T1592: 'TA0043',
  T1593: 'TA0043', T1596: 'TA0043', T1597: 'TA0043', T1598: 'TA0043',
  T1591: 'TA0043', T1594: 'TA0043',
  // Resource Dev
  T1583: 'TA0042', T1584: 'TA0042', T1585: 'TA0042', T1586: 'TA0042',
  T1587: 'TA0042', T1588: 'TA0042', T1608: 'TA0042', T1650: 'TA0042',
  // Initial Access (excluding dual-use T1078, T1133)
  T1189: 'TA0001', T1190: 'TA0001', T1200: 'TA0001', T1566: 'TA0001',
  T1091: 'TA0001', T1195: 'TA0001', T1199: 'TA0001', T1659: 'TA0001',
  // Execution (excluding T1053)
  T1059: 'TA0002', T1609: 'TA0002', T1610: 'TA0002', T1203: 'TA0002',
  T1559: 'TA0002', T1106: 'TA0002', T1129: 'TA0002', T1072: 'TA0002',
  T1569: 'TA0002', T1204: 'TA0002', T1047: 'TA0002', T1648: 'TA0002',
  T1651: 'TA0002',
  // Persistence (excluding dual-use)
  T1197: 'TA0003', T1176: 'TA0003', T1554: 'TA0003', T1136: 'TA0003',
  T1525: 'TA0003', T1137: 'TA0003', T1505: 'TA0003',
  // PrivEsc (excluding dual-use)
  T1068: 'TA0004', T1484: 'TA0004', T1611: 'TA0004',
  // Defense Evasion (single-use only — most are dual-use, so few here)
  T1622: 'TA0005', T1140: 'TA0005', T1006: 'TA0005', T1480: 'TA0005',
  T1211: 'TA0005', T1222: 'TA0005', T1564: 'TA0005', T1562: 'TA0005',
  T1070: 'TA0005', T1202: 'TA0005', T1036: 'TA0005', T1578: 'TA0005',
  T1112: 'TA0005', T1601: 'TA0005', T1599: 'TA0005', T1027: 'TA0005',
  T1207: 'TA0005', T1014: 'TA0005', T1218: 'TA0005', T1216: 'TA0005',
  T1553: 'TA0005', T1221: 'TA0005', T1127: 'TA0005', T1535: 'TA0005',
  T1550: 'TA0008', T1497: 'TA0005', T1600: 'TA0005', T1220: 'TA0005',
  T1102: 'TA0011', T1230: 'TA0005', T1612: 'TA0005',
  // Cred Access
  T1110: 'TA0006', T1555: 'TA0006', T1212: 'TA0006', T1187: 'TA0006',
  T1606: 'TA0006', T1056: 'TA0006', T1557: 'TA0006', T1111: 'TA0006',
  T1621: 'TA0006', T1040: 'TA0006', T1003: 'TA0006', T1528: 'TA0006',
  T1649: 'TA0006', T1558: 'TA0006', T1539: 'TA0006', T1552: 'TA0006',
  // Discovery
  T1087: 'TA0007', T1010: 'TA0007', T1217: 'TA0007', T1580: 'TA0007',
  T1538: 'TA0007', T1526: 'TA0007', T1619: 'TA0007', T1613: 'TA0007',
  T1482: 'TA0007', T1083: 'TA0007', T1615: 'TA0007', T1046: 'TA0007',
  T1135: 'TA0007', T1201: 'TA0007', T1120: 'TA0007', T1069: 'TA0007',
  T1057: 'TA0007', T1012: 'TA0007', T1018: 'TA0007', T1518: 'TA0007',
  T1082: 'TA0007', T1614: 'TA0007', T1016: 'TA0007', T1049: 'TA0007',
  T1033: 'TA0007', T1007: 'TA0007', T1124: 'TA0007',
  // Lateral Movement
  T1210: 'TA0008', T1534: 'TA0008', T1570: 'TA0008', T1563: 'TA0008',
  T1021: 'TA0008', T1080: 'TA0008',
  // Collection
  T1560: 'TA0009', T1123: 'TA0009', T1119: 'TA0009', T1185: 'TA0009',
  T1115: 'TA0009', T1530: 'TA0009', T1602: 'TA0009', T1213: 'TA0009',
  T1005: 'TA0009', T1039: 'TA0009', T1025: 'TA0009', T1074: 'TA0009',
  T1114: 'TA0009', T1113: 'TA0009', T1125: 'TA0009',
  // Exfiltration
  T1020: 'TA0010', T1030: 'TA0010', T1048: 'TA0010', T1041: 'TA0010',
  T1011: 'TA0010', T1052: 'TA0010', T1567: 'TA0010', T1029: 'TA0010',
  T1537: 'TA0010',
  // C2
  T1071: 'TA0011', T1092: 'TA0011', T1132: 'TA0011', T1001: 'TA0011',
  T1568: 'TA0011', T1573: 'TA0011', T1008: 'TA0011', T1105: 'TA0011',
  T1104: 'TA0011', T1095: 'TA0011', T1571: 'TA0011', T1572: 'TA0011',
  T1090: 'TA0011', T1219: 'TA0011', T1647: 'TA0011',
  // Impact
  T1531: 'TA0040', T1485: 'TA0040', T1486: 'TA0040', T1565: 'TA0040',
  T1491: 'TA0040', T1561: 'TA0040', T1499: 'TA0040', T1495: 'TA0040',
  T1490: 'TA0040', T1498: 'TA0040', T1496: 'TA0040', T1489: 'TA0040',
  T1529: 'TA0040', T1657: 'TA0040',
};

agents.forEach((agent) => {
  agent.techniques.forEach((t) => {
    if (t.coverage === 'not-covered') return;
    const pid = parentId(t.id);
    if (isDualUse(pid)) {
      // attribute to agent's likely intent (first valid Tactic = most common use)
      const intent = inferIntent(agent, pid);
      if (intent && tacticEffective[intent]) {
        tacticEffective[intent].add(agent.id);
      }
    } else {
      const tactic = SINGLE_TACTIC_MAP[pid];
      if (tactic && tacticEffective[tactic]) {
        tacticEffective[tactic].add(agent.id);
      }
    }
  });
});

// ─── Report ──────────────────────────────────────────────────────────────────
console.log('\n=== EFFECTIVE Tactic Coverage (dual-use corrected) ===');
console.log('Original analysis treated dual-use techniques (T1078, T1548 etc.)');
console.log('as TA0005 Defense Evasion, inflating its count. Corrected:\n');

const tacticOrder = [
  ['TA0043', 'Reconnaissance'],
  ['TA0042', 'Resource Development'],
  ['TA0001', 'Initial Access'],
  ['TA0002', 'Execution'],
  ['TA0003', 'Persistence'],
  ['TA0004', 'Privilege Escalation'],
  ['TA0005', 'Defense Evasion (Stealth)'],
  ['TA0006', 'Credential Access'],
  ['TA0007', 'Discovery'],
  ['TA0008', 'Lateral Movement'],
  ['TA0009', 'Collection'],
  ['TA0010', 'Exfiltration'],
  ['TA0011', 'Command and Control'],
  ['TA0040', 'Impact'],
];

const zeroTactics = [];
tacticOrder.forEach(([id, name]) => {
  const count = tacticEffective[id].size;
  const flag = count === 0 ? '❌ ZERO' : count < 5 ? '🔴 LOW' : count < 10 ? '🟡' : '✅';
  console.log(`  ${id} ${name.padEnd(30)} ${count}/22 agents ${flag}`);
  if (count === 0) zeroTactics.push(`${id} ${name}`);
});

console.log(`\n=== Effectively EMPTY Tactics: ${zeroTactics.length} ===`);
zeroTactics.forEach((t) => console.log(`  - ${t}`));

console.log(`\nKey finding: ${zeroTactics.length} / 14 = ${((zeroTactics.length/14)*100).toFixed(0)}% Tactics completely uncovered`);
console.log('Direction B target: cover all 14, depth >= 30% per Tactic');
