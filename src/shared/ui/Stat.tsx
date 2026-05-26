import clsx from 'clsx'
import type { ReactNode } from 'react'

type StatProps = {
  featured?: boolean
  label: ReactNode
  value: string
}

export function Stat({ featured = false, label, value }: StatProps) {
  return (
    <div className={clsx('stat-item', featured && 'featured-stat')}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}
