interface SeedNode {
  uuid: string
  techniqueId: string
  techniqueName: string
  tactic: string
  tacticId: string
  tool: string
  executor: string
  precondition: string
  cost: number
  rolledUp?: boolean
}

const SEED_NODES: SeedNode[] = [
  { uuid: 'aa-persist-01', techniqueId: 'T1053.005', techniqueName: 'Scheduled Task',  tactic: 'Persistence',    tacticId: 'TA0003', tool: 'schtasks',     executor: 'cmd',  precondition: 'admin',         cost: 0.2 },
  { uuid: 'aa-persist-02', techniqueId: 'T1505.003', techniqueName: 'Web Shell',       tactic: 'Persistence',    tacticId: 'TA0003', tool: 'curl upload',  executor: 'bash', precondition: 'http writable', cost: 0.3 },
  { uuid: 'aa-persist-03', techniqueId: 'T1098',     techniqueName: 'AD Account Manip',tactic: 'Persistence',    tacticId: 'TA0003', tool: 'net user',     executor: 'cmd',  precondition: 'domain admin',  cost: 0.1 },
  { uuid: 'aa-persist-04', techniqueId: 'T1547.001', techniqueName: 'Registry Run Key',tactic: 'Persistence',    tacticId: 'TA0003', tool: 'reg add',      executor: 'cmd',  precondition: 'user',          cost: 0.2 },
  { uuid: 'aa-persist-05', techniqueId: 'T1136.001', techniqueName: 'Local Account',   tactic: 'Persistence',    tacticId: 'TA0003', tool: 'useradd',      executor: 'bash', precondition: 'admin',         cost: 0.2 },
  { uuid: 'aa-c2-01',      techniqueId: 'T1572',     techniqueName: 'Chisel Tunnel',   tactic: 'C2',             tacticId: 'TA0011', tool: 'chisel',       executor: 'bash', precondition: 'outbound http', cost: 0.3 },
  { uuid: 'aa-c2-02',      techniqueId: 'T1132.001', techniqueName: 'Base64 Encoding', tactic: 'C2',             tacticId: 'TA0011', tool: 'powershell',   executor: 'ps',   precondition: 'user',          cost: 0.2 },
  { uuid: 'aa-c2-03',      techniqueId: 'T1571',     techniqueName: 'Non-Std Port',    tactic: 'C2',             tacticId: 'TA0011', tool: 'nc / bash',    executor: 'bash', precondition: 'user',          cost: 0.3 },
  { uuid: 'aa-c2-04',      techniqueId: 'T1105',     techniqueName: 'Tool Transfer',   tactic: 'C2',             tacticId: 'TA0011', tool: 'wget',         executor: 'bash', precondition: 'user',          cost: 0.1 },
  { uuid: 'aa-impact-01',  techniqueId: 'T1531',     techniqueName: 'Account Removal', tactic: 'Impact',         tacticId: 'TA0040', tool: 'net user dis', executor: 'cmd',  precondition: 'admin',         cost: 0.1, rolledUp: true },
  { uuid: 'aa-impact-02',  techniqueId: 'T1489',     techniqueName: 'Service Stop',    tactic: 'Impact',         tacticId: 'TA0040', tool: 'systemctl',    executor: 'bash', precondition: 'admin',         cost: 0.1, rolledUp: true },
]

const SCHEMA_NODES = [
  { type: 'Tactic',       desc: 'ATT&CK Tactic grouping (TA00xx)',      example: 'TA0003 Persistence' },
  { type: 'Technique',    desc: 'ATT&CK Technique (T1xxx[.xxx])',       example: 'T1505.003 Web Shell' },
  { type: 'AttackAction', desc: 'Concrete PDDL-style executable action', example: 'aa-persist-02 webshell_drop' },
  { type: 'Precondition', desc: 'Required system state to execute',     example: 'upload_endpoint_writable' },
]

const SCHEMA_EDGES = [
  { name: 'BELONGS_TO', from: 'Technique',     to: 'Tactic',       semantic: 'Technique is grouped under this Tactic' },
  { name: 'IMPLEMENTS', from: 'AttackAction',  to: 'Technique',    semantic: 'This concrete action realises that Technique' },
  { name: 'REQUIRES',   from: 'AttackAction',  to: 'Precondition', semantic: 'Action needs this state to be true' },
  { name: 'LEADS_TO',   from: 'Technique',     to: 'Technique',    semantic: 'Typical chain progression (planning edge)' },
  { name: 'ENABLES',    from: 'Technique',     to: 'Technique',    semantic: 'Completing one enables the other' },
]

const SAMPLE_QUERY = `// Query: given current state = Domain Admin, find next actions
MATCH (current:Technique {id: "T1078"})-[:LEADS_TO]->(next:Technique)
OPTIONAL MATCH (next)<-[:IMPLEMENTS]-(action:AttackAction)
RETURN next.id, next.name, action.name, action.cost
ORDER BY action.cost ASC;`

const TACTIC_COLOR: Record<string, string> = {
  TA0003: 'kg-tactic--persist',
  TA0011: 'kg-tactic--c2',
  TA0040: 'kg-tactic--impact',
}

export function KgSchema() {
  // group seed nodes by tactic for the grid
  const grouped: Record<string, SeedNode[]> = {}
  SEED_NODES.forEach((n) => {
    if (!grouped[n.tacticId]) grouped[n.tacticId] = []
    grouped[n.tacticId].push(n)
  })

  return (
    <div className="depth-panel">
      {/* Header */}
      <div className="depth-summary">
        <div className="depth-stat">
          <span className="depth-stat-value">4</span>
          <span className="depth-stat-label">Node Types</span>
        </div>
        <div className="depth-stat">
          <span className="depth-stat-value">5</span>
          <span className="depth-stat-label">Edge Types</span>
        </div>
        <div className="depth-stat depth-stat--warn">
          <span className="depth-stat-value">{SEED_NODES.length}</span>
          <span className="depth-stat-label">Seed AttackActions</span>
        </div>
        <div className="depth-stat">
          <a href="/kg-seed-nodes.cypher" download className="kg-download-btn">
            Download .cypher
          </a>
        </div>
      </div>

      {/* Schema diagram */}
      <section className="depth-section">
        <h2 className="depth-section-title">
          KG Schema — Node + Edge Definitions
          <span className="depth-section-sub">Property graph schema for Neo4j; see [[wiki/APT-GPT/Knowledge-Graph-Schema]]</span>
        </h2>

        <div className="kg-schema-grid">
          {/* Nodes */}
          <div className="kg-schema-col">
            <h3 className="kg-schema-h3">Node types</h3>
            <div className="kg-node-list">
              {SCHEMA_NODES.map((n) => (
                <div key={n.type} className="kg-node-card">
                  <div className="kg-node-type">({n.type})</div>
                  <div className="kg-node-desc">{n.desc}</div>
                  <code className="kg-node-example">{n.example}</code>
                </div>
              ))}
            </div>
          </div>

          {/* Edges */}
          <div className="kg-schema-col">
            <h3 className="kg-schema-h3">Edge types</h3>
            <div className="kg-edge-list">
              {SCHEMA_EDGES.map((e) => (
                <div key={e.name} className="kg-edge-card">
                  <div className="kg-edge-arrow">
                    <code className="kg-edge-from">{e.from}</code>
                    <span className="kg-edge-mark">-[{e.name}]→</span>
                    <code className="kg-edge-to">{e.to}</code>
                  </div>
                  <div className="kg-edge-semantic">{e.semantic}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Seed nodes by tactic */}
      <section className="depth-section">
        <h2 className="depth-section-title">
          Seed Nodes — 11 P0+Easy AttackActions
          <span className="depth-section-sub">target for Phase B4 implementation; covers TA0003 / TA0011 / TA0040 gaps</span>
        </h2>

        {Object.entries(grouped).map(([tid, nodes]) => (
          <div key={tid} className="kg-tactic-block">
            <div className={`kg-tactic-header ${TACTIC_COLOR[tid] ?? ''}`}>
              <code className="kg-tactic-id">{tid}</code>
              <span className="kg-tactic-name">{nodes[0].tactic}</span>
              <span className="kg-tactic-count">{nodes.length} actions</span>
            </div>
            <div className="kg-node-grid">
              {nodes.map((node) => (
                <div key={node.uuid} className="kg-seed-card">
                  <div className="kg-seed-uuid">{node.uuid}</div>
                  <div className="kg-seed-tech">
                    <code className="tid kg-seed-tid">{node.techniqueId}</code>
                    <span className="kg-seed-techname">{node.techniqueName}</span>
                  </div>
                  <div className="kg-seed-meta">
                    <span className="kg-seed-tool" title="executor / tool">
                      <code>{node.tool}</code> via <em>{node.executor}</em>
                    </span>
                    <span className="kg-seed-pre" title="precondition">
                      pre: <code>{node.precondition}</code>
                    </span>
                    <span className="kg-seed-cost" title="planning cost">
                      cost: <strong>{node.cost.toFixed(1)}</strong>
                    </span>
                  </div>
                  {node.rolledUp && (
                    <div className="kg-seed-flag">RoE-gated</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* Sample Cypher query */}
      <section className="depth-section">
        <h2 className="depth-section-title">
          Sample Cypher Query — Tactic Loop Decision
          <span className="depth-section-sub">how MARS-2 reasoning loop will query the KG at runtime</span>
        </h2>
        <pre className="kg-code-block">{SAMPLE_QUERY}</pre>
        <p className="kg-code-note">
          This single Cypher query is what enables proactive planning: given the agent's
          current state (which Techniques have been executed), find the next viable Techniques
          ranked by their action cost. Existing agents lack this query layer — Decepticon's Neo4j
          stores findings (what was discovered) but not capability graph (what can be done next).
        </p>
      </section>
    </div>
  )
}
