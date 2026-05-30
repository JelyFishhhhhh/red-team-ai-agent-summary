import { useState } from 'react'
import { useSort, applySortFn } from '../hooks/useSort'
import { SortTh } from './SortTh'
import type { Agent, Tactic, CoverageLevel } from '../types'

function parentId(id: string): string {
  return id.includes('.') ? id.split('.')[0] : id
}

interface TechniqueGap {
  tacticId: string
  tacticName: string
  techniqueId: string
  techniqueName: string
  subCount: number
  /** Agents with covered status for this exact T-ID */
  coveredBy: string[]
  partialBy: string[]
  /** Suggested tool / method to fill gap */
  suggestedTool: string
  /** Implementation difficulty estimate */
  difficulty: 'easy' | 'medium' | 'hard'
  priority: number  // 0 = highest (zero coverage)
}

// Tool / method suggestions per technique ID (curated based on Atomic Red Team + common red-team practice)
const TOOL_HINTS: Record<string, { tool: string; difficulty: 'easy' | 'medium' | 'hard' }> = {
  // Persistence (TA0003)
  T1053: { tool: 'schtasks / crontab', difficulty: 'easy' },
  T1547: { tool: 'registry Run keys / systemd', difficulty: 'medium' },
  T1505: { tool: 'webshell upload', difficulty: 'easy' },
  T1098: { tool: 'net user / DSAdd', difficulty: 'easy' },
  T1136: { tool: 'net user /add', difficulty: 'easy' },
  T1543: { tool: 'sc / systemctl', difficulty: 'medium' },
  T1546: { tool: 'WMI event subscription', difficulty: 'hard' },
  T1574: { tool: 'DLL search-order / hijack', difficulty: 'hard' },
  T1554: { tool: 'binary patching', difficulty: 'hard' },
  T1197: { tool: 'bitsadmin', difficulty: 'medium' },
  T1037: { tool: 'logon scripts', difficulty: 'medium' },
  T1176: { tool: 'browser extension', difficulty: 'medium' },
  T1525: { tool: 'docker image embed', difficulty: 'medium' },
  T1133: { tool: 'VPN / RDP setup', difficulty: 'medium' },
  T1137: { tool: 'Office add-in', difficulty: 'medium' },
  T1205: { tool: 'port-knock daemon', difficulty: 'hard' },
  T1542: { tool: 'bootkit', difficulty: 'hard' },
  T1556: { tool: 'PAM hijack', difficulty: 'hard' },

  // Command and Control (TA0011)
  T1071: { tool: 'sliver / merlin / mythic', difficulty: 'medium' },
  T1095: { tool: 'icmp / raw TCP C2', difficulty: 'hard' },
  T1573: { tool: 'TLS C2 channel', difficulty: 'medium' },
  T1132: { tool: 'base64 / steganography', difficulty: 'easy' },
  T1001: { tool: 'DNS tunneling (iodine)', difficulty: 'medium' },
  T1568: { tool: 'DGA implementation', difficulty: 'hard' },
  T1008: { tool: 'fallback channel logic', difficulty: 'medium' },
  T1105: { tool: 'wget / certutil / curl', difficulty: 'easy' },
  T1104: { tool: 'C2 staging logic', difficulty: 'medium' },
  T1571: { tool: 'non-standard port C2', difficulty: 'easy' },
  T1572: { tool: 'chisel / ngrok', difficulty: 'easy' },
  T1090: { tool: 'proxychains / chisel', difficulty: 'easy' },
  T1219: { tool: 'TeamViewer / AnyDesk', difficulty: 'medium' },
  T1102: { tool: 'github / pastebin C2', difficulty: 'medium' },
  T1659: { tool: 'web injected JS C2', difficulty: 'hard' },
  T1647: { tool: 'plist hijack', difficulty: 'hard' },

  // Impact (TA0040)
  T1486: { tool: 'symmetric file crypto', difficulty: 'medium' },
  T1485: { tool: 'rm -rf / sdelete', difficulty: 'easy' },
  T1490: { tool: 'vssadmin delete', difficulty: 'easy' },
  T1489: { tool: 'systemctl stop / Stop-Service', difficulty: 'easy' },
  T1529: { tool: 'shutdown / reboot', difficulty: 'easy' },
  T1495: { tool: 'firmware flashing', difficulty: 'hard' },
  T1491: { tool: 'web defacement payload', difficulty: 'easy' },
  T1565: { tool: 'data tampering', difficulty: 'medium' },
  T1561: { tool: 'dd / sdelete disk wipe', difficulty: 'medium' },
  T1499: { tool: 'DoS tools (banned)', difficulty: 'easy' },
  T1498: { tool: 'flood tools (banned)', difficulty: 'easy' },
  T1531: { tool: 'net user disable', difficulty: 'easy' },
  T1496: { tool: 'crypto miner deploy', difficulty: 'medium' },
  T1657: { tool: 'financial theft', difficulty: 'medium' },

  // Resource Development (TA0042)
  T1583: { tool: 'domain registration / VPS', difficulty: 'medium' },
  T1584: { tool: 'compromised infra reuse', difficulty: 'hard' },
  T1585: { tool: 'fake account creation', difficulty: 'medium' },
  T1586: { tool: 'account compromise', difficulty: 'hard' },
  T1587: { tool: 'malware compilation', difficulty: 'hard' },
  T1588: { tool: 'public exploit retrieval', difficulty: 'easy' },
  T1608: { tool: 'payload staging', difficulty: 'medium' },
  T1650: { tool: 'credential purchase', difficulty: 'hard' },

  // Privilege Escalation gaps
  T1055: { tool: 'process injection (CreateRemoteThread)', difficulty: 'hard' },
  T1134: { tool: 'token impersonation', difficulty: 'medium' },
  T1484: { tool: 'GPO modification', difficulty: 'medium' },
  T1611: { tool: 'container escape', difficulty: 'hard' },

  // Execution gaps
  T1047: { tool: 'wmic / Invoke-WmiMethod', difficulty: 'easy' },
  T1569: { tool: 'PsExec / sc create', difficulty: 'easy' },
  T1106: { tool: 'native API CreateProcess', difficulty: 'medium' },
  T1129: { tool: 'reflective DLL', difficulty: 'hard' },
  T1559: { tool: 'COM / DDE invocation', difficulty: 'hard' },
  T1203: { tool: 'document exploits', difficulty: 'medium' },
  T1204: { tool: 'social engineering payload', difficulty: 'medium' },
  T1609: { tool: 'kubectl exec', difficulty: 'easy' },
  T1610: { tool: 'docker run', difficulty: 'easy' },
  T1648: { tool: 'serverless function trigger', difficulty: 'medium' },
  T1651: { tool: 'cloud admin API', difficulty: 'medium' },
  T1072: { tool: 'SCCM / Ansible abuse', difficulty: 'hard' },

  // Collection gaps
  T1560: { tool: 'tar / zip / 7z', difficulty: 'easy' },
  T1074: { tool: 'staging dir + cp', difficulty: 'easy' },
  T1113: { tool: 'screencapture / scrot', difficulty: 'easy' },
  T1125: { tool: 'webcam capture', difficulty: 'medium' },
  T1115: { tool: 'pbpaste / xclip', difficulty: 'easy' },
  T1119: { tool: 'find + cp automation', difficulty: 'easy' },
  T1185: { tool: 'browser cookie steal', difficulty: 'medium' },
  T1530: { tool: 'aws s3 / gsutil', difficulty: 'easy' },
  T1602: { tool: 'snmpwalk', difficulty: 'medium' },
  T1213: { tool: 'confluence / wiki scrape', difficulty: 'medium' },
  T1039: { tool: 'smbclient get', difficulty: 'easy' },
  T1025: { tool: 'find removable media', difficulty: 'medium' },
  T1114: { tool: 'IMAP / Exchange API', difficulty: 'medium' },

  // Exfiltration gaps
  T1020: { tool: 'rsync automation', difficulty: 'easy' },
  T1030: { tool: 'split + send chunks', difficulty: 'easy' },
  T1048: { tool: 'curl / scp to attacker server', difficulty: 'easy' },
  T1041: { tool: 'C2 file upload', difficulty: 'easy' },
  T1011: { tool: 'bluetooth / WiFi beacon', difficulty: 'hard' },
  T1052: { tool: 'USB device write', difficulty: 'medium' },
  T1567: { tool: 'curl to S3 / Mega / Dropbox', difficulty: 'easy' },
  T1029: { tool: 'cron exfil + jitter', difficulty: 'medium' },
}

function getToolHint(tid: string): { tool: string; difficulty: 'easy' | 'medium' | 'hard' } {
  return TOOL_HINTS[tid] ?? { tool: '—', difficulty: 'medium' }
}

function buildGaps(agents: Agent[], tactics: Tactic[]): TechniqueGap[] {
  // For each (tactic, technique), compute which agents have coverage on parent T-ID
  // We treat coverage at parent level (sub-techniques inherit)
  return tactics.flatMap((tactic) =>
    tactic.techniques.map((tech) => {
      const coveredBy: string[] = []
      const partialBy: string[] = []
      agents.forEach((agent) => {
        const matched = agent.techniques.filter(
          (t) => parentId(t.id) === tech.id ||
                 tech.sub_techniques.some((st) => st.id === t.id)
        )
        let best: CoverageLevel | null = null
        matched.forEach((m) => {
          if (m.coverage !== 'not-covered') {
            if (!best || m.coverage === 'covered') best = m.coverage
          }
        })
        if (best === 'covered') coveredBy.push(agent.name)
        else if (best === 'partial' || best === 'tool-dep') partialBy.push(agent.name)
      })
      const hint = getToolHint(tech.id)
      const priority = coveredBy.length === 0 && partialBy.length === 0 ? 0
        : coveredBy.length === 0 ? 1
        : coveredBy.length <= 2 ? 2 : 3
      return {
        tacticId: tactic.id,
        tacticName: tactic.name,
        techniqueId: tech.id,
        techniqueName: tech.name,
        subCount: tech.sub_techniques.length,
        coveredBy,
        partialBy,
        suggestedTool: hint.tool,
        difficulty: hint.difficulty,
        priority,
      }
    })
  )
}

type Col = 'tactic' | 'technique' | 'covered' | 'partial' | 'difficulty' | 'priority'

interface Props {
  agents: Agent[]
  tactics: Tactic[]
}

const DIFFICULTY_RANK: Record<string, number> = { easy: 1, medium: 2, hard: 3 }

export function GapRoadmap({ agents, tactics }: Props) {
  const allGaps = buildGaps(agents, tactics)
  const [filter, setFilter] = useState<'all' | 'zero' | 'low' | 'easy-wins'>('zero')
  const [tacticFilter, setTacticFilter] = useState<string>('all')

  const filtered = allGaps.filter((g) => {
    if (filter === 'zero' && g.coveredBy.length + g.partialBy.length > 0) return false
    if (filter === 'low' && g.coveredBy.length > 2) return false
    if (filter === 'easy-wins' && (g.coveredBy.length > 0 || g.difficulty !== 'easy')) return false
    if (tacticFilter !== 'all' && g.tacticId !== tacticFilter) return false
    return true
  })

  const { sort, toggle } = useSort<Col>('priority', 'asc')

  const sorted = applySortFn<TechniqueGap, Col>(filtered, sort, (g, key) => {
    switch (key) {
      case 'tactic':     return g.tacticName
      case 'technique':  return g.techniqueId
      case 'covered':    return g.coveredBy.length
      case 'partial':    return g.partialBy.length
      case 'difficulty': return DIFFICULTY_RANK[g.difficulty]
      case 'priority':   return g.priority
      default:           return ''
    }
  })

  // Tactic-level summary
  const tacticSummary = tactics.map((t) => {
    const inTactic = allGaps.filter((g) => g.tacticId === t.id)
    const zero = inTactic.filter((g) => g.coveredBy.length + g.partialBy.length === 0).length
    return { id: t.id, name: t.name, total: inTactic.length, zero }
  })

  const counts = {
    total: allGaps.length,
    zero: allGaps.filter((g) => g.coveredBy.length + g.partialBy.length === 0).length,
    easyWins: allGaps.filter((g) => g.coveredBy.length === 0 && g.difficulty === 'easy').length,
  }

  const thProps = (key: Col) => ({
    sortKey: key, activeKey: sort.key, dir: sort.dir, onClick: () => toggle(key),
  })

  return (
    <div className="depth-panel">

      {/* Summary */}
      <div className="depth-summary">
        <div className="depth-stat">
          <span className="depth-stat-value">{counts.total}</span>
          <span className="depth-stat-label">Total Techniques (ATT&amp;CK v16)</span>
        </div>
        <div className="depth-stat depth-stat--danger">
          <span className="depth-stat-value">{counts.zero}</span>
          <span className="depth-stat-label">Zero Coverage</span>
        </div>
        <div className="depth-stat depth-stat--warn">
          <span className="depth-stat-value">{counts.easyWins}</span>
          <span className="depth-stat-label">Easy Wins (uncovered + easy)</span>
        </div>
        <div className="depth-stat">
          <span className="depth-stat-value">{filtered.length}</span>
          <span className="depth-stat-label">Currently Shown</span>
        </div>
      </div>

      {/* Tactic mini-summary chips */}
      <section className="depth-section">
        <h2 className="depth-section-title">
          Tactic Gap Overview
          <span className="depth-section-sub">click to filter; numbers show zero-coverage / total Techniques</span>
        </h2>
        <div className="gap-tactic-chips">
          <button
            className={`gap-chip ${tacticFilter === 'all' ? 'gap-chip--active' : ''}`}
            onClick={() => setTacticFilter('all')}
          >
            All Tactics
          </button>
          {tacticSummary.map((t) => {
            const pct = t.total > 0 ? (t.zero / t.total) * 100 : 0
            return (
              <button
                key={t.id}
                className={`gap-chip ${tacticFilter === t.id ? 'gap-chip--active' : ''} ${pct === 100 ? 'gap-chip--severe' : pct > 50 ? 'gap-chip--warn' : ''}`}
                onClick={() => setTacticFilter(t.id)}
                title={t.name}
              >
                <span className="gap-chip-id">{t.id}</span>
                <span className="gap-chip-name">{t.name}</span>
                <span className="gap-chip-count">{t.zero}/{t.total}</span>
              </button>
            )
          })}
        </div>
      </section>

      {/* Filter row */}
      <section className="depth-section">
        <h2 className="depth-section-title">
          Table D — Per-Technique Gap Roadmap
          <span className="depth-section-sub">
            {sorted.length} techniques shown · default sort: priority asc (0 = zero-coverage)
          </span>
        </h2>
        <div className="gap-filter-row">
          <button className={`gap-filter ${filter === 'all' ? 'gap-filter--active' : ''}`} onClick={() => setFilter('all')}>
            All ({allGaps.length})
          </button>
          <button className={`gap-filter ${filter === 'zero' ? 'gap-filter--active' : ''}`} onClick={() => setFilter('zero')}>
            Zero Coverage ({counts.zero})
          </button>
          <button className={`gap-filter ${filter === 'low' ? 'gap-filter--active' : ''}`} onClick={() => setFilter('low')}>
            Low Coverage (≤2 agents)
          </button>
          <button className={`gap-filter ${filter === 'easy-wins' ? 'gap-filter--active' : ''}`} onClick={() => setFilter('easy-wins')}>
            Easy Wins ({counts.easyWins})
          </button>
        </div>

        <div className="depth-table-b-wrap">
          <table className="depth-table-b gap-table">
            <thead>
              <tr>
                <SortTh label="Priority"   {...thProps('priority')} />
                <SortTh label="Tactic"     {...thProps('tactic')} />
                <SortTh label="Technique"  {...thProps('technique')} />
                <SortTh label="Covered by" {...thProps('covered')} />
                <SortTh label="Partial"    {...thProps('partial')} />
                <th>Suggested Tool / Method</th>
                <SortTh label="Difficulty" {...thProps('difficulty')} />
              </tr>
            </thead>
            <tbody>
              {sorted.map((g) => (
                <tr key={`${g.tacticId}-${g.techniqueId}`} className={`depth-row gap-row gap-row--p${g.priority}`}>
                  <td>
                    <span className={`gap-prio gap-prio--${g.priority}`}>P{g.priority}</span>
                  </td>
                  <td className="depth-tactic-cell">
                    <span className="depth-tactic-id">{g.tacticId}</span>
                    <span className="depth-tactic-name">{g.tacticName}</span>
                  </td>
                  <td>
                    <div className="gap-tech">
                      <code className="tid gap-tid">{g.techniqueId}</code>
                      <span className="gap-tech-name">{g.techniqueName}</span>
                      {g.subCount > 0 && <span className="gap-subcount">+{g.subCount} sub</span>}
                    </div>
                  </td>
                  <td>
                    {g.coveredBy.length === 0
                      ? <span className="gap-none">—</span>
                      : <div className="gap-agents">
                          {g.coveredBy.slice(0, 3).map((n) => (
                            <span key={n} className="gap-agent gap-agent--covered">{n}</span>
                          ))}
                          {g.coveredBy.length > 3 && <span className="gap-agent-more">+{g.coveredBy.length - 3}</span>}
                        </div>
                    }
                  </td>
                  <td>
                    {g.partialBy.length === 0
                      ? <span className="gap-none">—</span>
                      : <div className="gap-agents">
                          {g.partialBy.slice(0, 3).map((n) => (
                            <span key={n} className="gap-agent gap-agent--partial">{n}</span>
                          ))}
                          {g.partialBy.length > 3 && <span className="gap-agent-more">+{g.partialBy.length - 3}</span>}
                        </div>
                    }
                  </td>
                  <td className="gap-tool-cell">
                    <code className="gap-tool">{g.suggestedTool}</code>
                  </td>
                  <td>
                    <span className={`gap-diff gap-diff--${g.difficulty}`}>{g.difficulty}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
