import type { ReactNode } from 'react'

import styles from './SettingsSection.module.css'

type SettingsSectionProps = {
  readonly children: ReactNode
  readonly 'data-testid'?: string
  readonly note?: string
  readonly title: string
}

export function SettingsSection({ children, 'data-testid': testId, note, title }: SettingsSectionProps) {
  return (
    <section className={styles.section} data-testid={testId}>
      <h3 className={styles.heading}>{title}</h3>
      {note ? <p className={styles.note}>{note}</p> : null}
      <div className={styles.body}>{children}</div>
    </section>
  )
}
