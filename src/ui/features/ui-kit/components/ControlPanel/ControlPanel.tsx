import type { ReactNode } from 'react'

import styles from './ControlPanel.module.css'

type ControlPanelProps = {
  readonly children: ReactNode
  readonly 'data-testid'?: string
  readonly title?: string
  readonly readout?: ReactNode
  readonly maxWidth?: number
}

export function ControlPanel({ children, 'data-testid': testId, maxWidth, readout, title }: ControlPanelProps) {
  return (
    <section
      className={styles.panel}
      data-testid={testId}
      style={maxWidth === undefined ? undefined : { maxWidth: `${maxWidth}px` }}
    >
      {title || readout ? (
        <header className={styles.heading}>
          <span>{title}</span>
          {readout ? <output>{readout}</output> : null}
        </header>
      ) : null}
      {children}
    </section>
  )
}
