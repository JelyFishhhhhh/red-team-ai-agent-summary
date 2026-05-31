interface Bottleneck {
  id: string
  title: string
  blockerOf: string[]
  rootCause: string
  evidence: string
  solution: string
  week: string
}

const BOTTLENECKS: Bottleneck[] = [
  {
    id: 'A',
    title: 'Memory / State Management',
    blockerOf: ['TA0003 Persistence', 'cross-session continuity'],
    rootCause: 'Fresh context per objective (Decepticon design); PTT only intra-session (PentestGPT); no cross-session memory in any public agent',
    evidence: 'TA0003 = 0/19 agents covered',
    solution: 'Cross-objective Memory Stream + KG-backed state graph',
    week: 'W1',
  },
  {
    id: 'B',
    title: 'Async Long-Horizon Reasoning',
    blockerOf: ['TA0011 C2', 'TA0003 verification'],
    rootCause: 'All public agents use synchronous reasoning loop (action → observe → reason). No wall-clock awareness, no callback or event-driven mechanism.',
    evidence: 'TA0011 = 0/19; no agent supports beacon scheduling',
    solution: 'Time-aware scheduler + Beacon-style action queue',
    week: 'W3',
  },
  {
    id: 'C',
    title: 'External Infrastructure Coordination',
    blockerOf: ['TA0011 C2', 'TA0042 Resource Dev'],
    rootCause: 'All benchmarks (XBOW/HTB/Cybench) are closed sandboxes. No attacker-side infra. Sliver/Mythic/Cobalt Strike designed for human operators, not agents.',
    evidence: 'TA0042 = 0/19; TA0011 = 0/19',
    solution: 'Integrate sliver-server (agent controls C2 framework)',
    week: 'W3',
  },
  {
    id: 'D',
    title: 'Tool Wrapper Scalability',
    blockerOf: ['Technique depth across all Tactics'],
    rootCause: 'Each Technique = ~200-500 LOC wrapper. Linear cost. 234 Techniques × 50 LOC = 12K LOC just for wrappers; with sub-techniques: 30K+ LOC.',
    evidence: 'Decepticon (best) covers only 27 unique parent T-IDs',
    solution: 'Atomic Red Team YAML auto-import → declarative spec',
    week: 'W2',
  },
  {
    id: 'E',
    title: 'Planning / Discovery Mechanism',
    blockerOf: ['Tactic breadth (all 14)'],
    rootCause: 'No attack KG = no "next action" awareness. Reactive decisions only. LLM training bias toward popular Techniques. CTF benchmarks reward "first flag" not "all Techniques".',
    evidence: 'TA0001 Initial Access: 18/19; TA0040 Impact: 0/19 (not because harder, because no reward signal)',
    solution: 'ATT&CK KG-driven Tactic loop (core of Direction B)',
    week: 'W1 (partial)',
  },
  {
    id: 'F',
    title: 'Evaluation / Sandbox Constraints',
    blockerOf: ['TA0040 Impact', 'TA0005 Defense Evasion'],
    rootCause: 'No destructive-friendly benchmark. Lab reset cost discourages Impact ops. No EDR/SIEM peer in public benchmarks.',
    evidence: 'TA0040 = 0/19; TA0005 = 2/19 partial',
    solution: 'GOAD v3 + snapshot/restore + Impact-friendly metric',
    week: 'W4',
  },
]

const WEEKLY_PLAN = [
  {
    week: 'W1',
    title: 'Foundation — Memory + Planning',
    targets: ['A', 'E'],
    tasks: [
      'Import 11 P0+Easy seed nodes into Neo4j (kg-seed-nodes.cypher)',
      'Design MemoryStream schema: cross-objective state accumulation',
      'Implement get_next_actions(state, goal) Cypher query API',
      'Wire MARS-2 main loop to KG-driven planning',
      'Regression test on Metasploitable 2 (preserve 60% baseline)',
    ],
    acceptance: 'MARS-2 retains existing capabilities + uses KG to plan next step',
  },
  {
    week: 'W2',
    title: 'Depth multiplier — Tool wrapper scalability',
    targets: ['D'],
    tasks: [
      'Write Atomic Red Team YAML parser (atomics/*.yaml → AttackActionNode)',
      'Auto-import: full TA0003 (19) + full TA0011 (18) = 37 new nodes',
      'Human-review LEADS_TO / REQUIRES / ENABLES edges',
      'Add TA0042 + TA0040 easy/medium Techniques',
      'Run mixed-Technique test on Metasploitable',
    ],
    acceptance: 'KG ≥ 80 Technique nodes; each Tactic ≥ 5 Techniques',
  },
  {
    week: 'W3',
    title: 'Long-horizon + External infra',
    targets: ['B', 'C'],
    tasks: [
      'Integrate sliver-server: MARS-2 starts listener via sliver CLI',
      'Design BeaconScheduler: agent can schedule "30s later verify"',
      'Implement Persistence verification loop: place → wait → reconnect → validate',
      'First long-horizon run on GOAD v3: webshell → chisel → tool transfer → verify',
      'Robustness fixes: timeout / retry / implant crash handling',
    ],
    acceptance: '≥6-step chain on GOAD v3 with implant alive after 30 min',
  },
  {
    week: 'W4',
    title: 'Evaluation + Partner integration',
    targets: ['F'],
    tasks: [
      'GOAD v3 snapshot/restore pipeline (auto-reset per experiment)',
      'E1: MARS-2 vs Decepticon — Tactic breadth on GOAD v3',
      'E2: Technique depth on Persistence + C2',
      'E3: APT29 TTP from Partner → MARS-2 imitation → overlap %',
      'E4: KG ablation (with vs without KG)',
    ],
    acceptance: '4 experiments produce paper-ready numbers',
  },
]

const RISKS = [
  { risk: 'sliver integration stalls (C2 API unstable)', prob: 'medium', impact: 'high', mitigation: 'Fallback: simplified reverse shell + custom listener (reduces scope but works)' },
  { risk: 'Atomic Red Team YAML parse failure', prob: 'medium', impact: 'medium', mitigation: 'Fallback to hand-written wrapper for top-20 Techniques → still 80+ nodes' },
  { risk: 'GOAD v3 instability / slow snapshots', prob: 'high', impact: 'medium', mitigation: 'Pre-snapshot common states; docker-compose for fast reset' },
  { risk: 'Memory state integration conflict', prob: 'medium', impact: 'high', mitigation: 'Start with dict-based state; upgrade to KG-backed after verified' },
  { risk: 'Professor requests scope change', prob: 'low', impact: 'high', mitigation: 'B1+B3 deliverables anchor direction; show data first' },
]

export function Bottlenecks() {
  return (
    <div className="depth-panel">
      {/* Header */}
      <div className="depth-summary">
        <div className="depth-stat">
          <span className="depth-stat-value">{BOTTLENECKS.length}</span>
          <span className="depth-stat-label">Structural Bottlenecks</span>
        </div>
        <div className="depth-stat depth-stat--warn">
          <span className="depth-stat-value">4</span>
          <span className="depth-stat-label">Tactics fully blocked</span>
        </div>
        <div className="depth-stat">
          <span className="depth-stat-value">4</span>
          <span className="depth-stat-label">Week Plan (Phase B4)</span>
        </div>
        <div className="depth-stat">
          <span className="depth-stat-value">11.5%→?</span>
          <span className="depth-stat-label">Coverage target</span>
        </div>
      </div>

      {/* Intro */}
      <section className="depth-section">
        <div className="chain-intro">
          <p>
            <strong>Why public agents cannot fill these gaps with just more tool wrappers:</strong>{' '}
            six structural bottlenecks prevent it. This page maps each bottleneck to its root cause,
            evidence, engineering solution, and target week in the Phase B4 implementation plan.
          </p>
          <p style={{ marginTop: 8 }}>
            Source: <code>wiki/APT-GPT/Bottleneck-Analysis.md</code>
          </p>
        </div>
      </section>

      {/* Bottleneck cards */}
      <section className="depth-section">
        <h2 className="depth-section-title">
          Part 1 — Bottleneck Analysis
          <span className="depth-section-sub">click a card to reveal full root-cause analysis</span>
        </h2>
        <div className="bottleneck-grid">
          {BOTTLENECKS.map((b) => (
            <div key={b.id} className="bottleneck-card">
              <div className="bottleneck-header">
                <span className="bottleneck-id">Bottleneck {b.id}</span>
                <span className="bottleneck-week">target: {b.week}</span>
              </div>
              <h3 className="bottleneck-title">{b.title}</h3>
              <div className="bottleneck-blocks">
                <span className="bottleneck-blocks-label">blocks:</span>
                {b.blockerOf.map((bo) => (
                  <code key={bo} className="bottleneck-block">{bo}</code>
                ))}
              </div>
              <div className="bottleneck-section">
                <div className="bottleneck-section-label">Root cause</div>
                <p className="bottleneck-text">{b.rootCause}</p>
              </div>
              <div className="bottleneck-section">
                <div className="bottleneck-section-label">Evidence</div>
                <p className="bottleneck-text bottleneck-evidence">{b.evidence}</p>
              </div>
              <div className="bottleneck-section">
                <div className="bottleneck-section-label">Solution</div>
                <p className="bottleneck-text bottleneck-solution">{b.solution}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Weekly plan */}
      <section className="depth-section">
        <h2 className="depth-section-title">
          Part 2 — Phase B4 Implementation Plan (4 weeks)
          <span className="depth-section-sub">bottleneck dependencies dictate the order</span>
        </h2>
        <div className="plan-grid">
          {WEEKLY_PLAN.map((w) => (
            <div key={w.week} className="plan-card">
              <div className="plan-header">
                <span className="plan-week">{w.week}</span>
                <span className="plan-targets">
                  solves: {w.targets.map((t) => (
                    <code key={t} className="plan-target">{t}</code>
                  ))}
                </span>
              </div>
              <h3 className="plan-title">{w.title}</h3>
              <ul className="plan-tasks">
                {w.tasks.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
              <div className="plan-acceptance">
                <span className="plan-acceptance-label">Acceptance:</span>{' '}
                <span className="plan-acceptance-text">{w.acceptance}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Risk table */}
      <section className="depth-section">
        <h2 className="depth-section-title">
          Part 3 — Risk Assessment
          <span className="depth-section-sub">known risks with mitigation pre-planned</span>
        </h2>
        <div className="depth-table-b-wrap">
          <table className="depth-table-b">
            <thead>
              <tr>
                <th>Risk</th>
                <th>Probability</th>
                <th>Impact</th>
                <th>Mitigation</th>
              </tr>
            </thead>
            <tbody>
              {RISKS.map((r, i) => (
                <tr key={i} className="depth-row">
                  <td>{r.risk}</td>
                  <td><span className={`risk-pill risk-pill--${r.prob}`}>{r.prob}</span></td>
                  <td><span className={`risk-pill risk-pill--${r.impact}`}>{r.impact}</span></td>
                  <td className="risk-mitigation">{r.mitigation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
