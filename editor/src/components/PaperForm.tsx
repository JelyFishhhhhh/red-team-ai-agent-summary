import type { Agent } from '../types'

interface Props {
  agent: Agent
  onChange: (updated: Agent) => void
}

function field(
  label: string,
  value: string,
  onChange: (v: string) => void,
  full = false,
  textarea = false
) {
  return (
    <div className={`form-field${full ? ' full' : ''}`}>
      <label>{label}</label>
      {textarea
        ? <textarea value={value} onChange={(e) => onChange(e.target.value)} />
        : <input type="text" value={value} onChange={(e) => onChange(e.target.value)} />}
    </div>
  )
}

export function PaperForm({ agent, onChange }: Props) {
  function updatePaper(key: keyof typeof agent.paper, value: string | number) {
    onChange({ ...agent, paper: { ...agent.paper, [key]: value } })
  }

  function updateAgentField(key: 'id' | 'name', value: string) {
    onChange({ ...agent, [key]: value })
  }

  return (
    <div>
      <div className="form-grid" style={{ marginBottom: 20 }}>
        {field('Agent ID (slug)', agent.id, (v) => updateAgentField('id', v))}
        {field('Display Name', agent.name, (v) => updateAgentField('name', v))}
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-muted)', marginBottom: 10 }}>Paper</div>
      <div className="form-grid">
        {field('Title', agent.paper.title, (v) => updatePaper('title', v), true)}
        {field('Venue', agent.paper.venue, (v) => updatePaper('venue', v))}
        {field('Year', String(agent.paper.year), (v) => updatePaper('year', Number(v)))}
        {field('Affiliation', agent.paper.affiliation, (v) => updatePaper('affiliation', v))}
        {field('arXiv ID', agent.paper.arxiv ?? '', (v) => updatePaper('arxiv', v))}
        {field('URL', agent.paper.url, (v) => updatePaper('url', v))}
        {field('Authors (comma-separated)', agent.paper.authors.join(', '), (v) =>
          onChange({ ...agent, paper: { ...agent.paper, authors: v.split(',').map((s) => s.trim()) } })
        , true)}
        {field('Tags (comma-separated)', agent.paper.tags.join(', '), (v) =>
          onChange({ ...agent, paper: { ...agent.paper, tags: v.split(',').map((s) => s.trim()).filter(Boolean) } })
        , true)}
        {field('Summary', agent.paper.summary, (v) => updatePaper('summary', v), true, true)}
      </div>
    </div>
  )
}
