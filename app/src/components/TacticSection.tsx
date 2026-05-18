import type { Tactic, Agent } from '../types'
interface Props { tactic: Tactic; agent: Agent }
export function TacticSection({ tactic }: Props) { return <div>{tactic.name}</div> }
