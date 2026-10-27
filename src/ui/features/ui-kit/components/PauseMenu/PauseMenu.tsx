import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

import { ControlButton } from '../ControlButton/ControlButton'
import { ControlPanel } from '../ControlPanel/ControlPanel'
import styles from './PauseMenu.module.css'

export type PauseMenuEntry = {
  readonly id: string
  readonly label: string
}

type PauseMenuProps = {
  readonly activeEntryId: string | null
  readonly children?: ReactNode
  readonly 'data-testid'?: string
  readonly entries: readonly PauseMenuEntry[]
  readonly hint?: string
  readonly onBack: () => void
  readonly onResume: () => void
  readonly onSelect: (id: string) => void
  readonly resumeLabel?: string
  readonly title?: string
}

export function PauseMenu({
  activeEntryId,
  children,
  'data-testid': testId,
  entries,
  hint,
  onBack,
  onResume,
  onSelect,
  resumeLabel = 'Resume',
  title = 'Paused',
}: PauseMenuProps) {
  const panel = useRef<HTMLDivElement>(null)
  const active = entries.find((entry) => entry.id === activeEntryId) ?? null

  useEffect(() => {
    panel.current?.querySelector<HTMLElement>('button, input')?.focus()
  }, [activeEntryId])

  return (
    <div className={styles.backdrop} data-testid={testId}>
      <div className={styles.frame} ref={panel} role="dialog" aria-label={active ? active.label : title}>
        <ControlPanel maxWidth={340} title={active ? active.label : title}>
          {active ? (
            <>
              <div className={styles.body}>{children}</div>
              <div className={styles.actions}>
                <ControlButton data-testid="pause-back" onClick={onBack}>
                  Back
                </ControlButton>
              </div>
            </>
          ) : (
            <>
              {hint ? <p className={styles.hint}>{hint}</p> : null}
              <nav className={styles.list}>
                {entries.map((entry) => (
                  <ControlButton
                    data-testid={`pause-entry-${entry.id}`}
                    key={entry.id}
                    onClick={() => onSelect(entry.id)}
                  >
                    {entry.label}
                  </ControlButton>
                ))}
                <ControlButton data-testid="pause-resume" onClick={onResume} variant="accent">
                  {resumeLabel}
                </ControlButton>
              </nav>
            </>
          )}
        </ControlPanel>
      </div>
    </div>
  )
}

