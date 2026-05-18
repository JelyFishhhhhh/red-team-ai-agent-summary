import type { Agent, Tactic } from '../types'
interface Props { agents: Agent[]; tactics: Tactic[]; onSelectAgent: (id: string) => void }
export function OverviewMatrix({ agents }: Props) { return <div>{agents.length} agents loaded</div> }
