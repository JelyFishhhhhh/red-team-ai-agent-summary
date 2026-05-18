import type { Agent, AttackData } from '../types'
interface Props { agent: Agent; attack: AttackData }
export function PaperSidebar({ agent }: Props) { return <aside>{agent.name}</aside> }
