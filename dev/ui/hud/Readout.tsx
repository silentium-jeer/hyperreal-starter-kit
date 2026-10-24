import type { ReactNode } from 'react'

import styles from './LabHud.module.css'

// Label / value rows for a lab's live numbers.
export function Readout({ rows, testId }: { rows: [string, ReactNode][]; testId?: string }) {
  return (
    <dl className={styles.rows} data-testid={testId}>
      {rows.map(([label, value]) => (
        <div key={label} style={{ display: 'contents' }}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}
