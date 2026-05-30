import type { SortDir } from '../hooks/useSort'

interface Props {
  label: string
  sortKey: string
  activeKey: string | null
  dir: SortDir
  onClick: () => void
  className?: string
  title?: string
}

export function SortTh({ label, sortKey, activeKey, dir, onClick, className, title }: Props) {
  const isActive = activeKey === sortKey
  const indicator = isActive && dir === 'asc' ? ' ↑' : isActive && dir === 'desc' ? ' ↓' : ''
  return (
    <th
      className={`sort-th${isActive ? ' sort-th--active' : ''} ${className ?? ''}`}
      onClick={onClick}
      title={title ?? `Sort by ${label}`}
      aria-sort={isActive ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      {label}
      <span className="sort-indicator">{indicator || ' ↕'}</span>
    </th>
  )
}
