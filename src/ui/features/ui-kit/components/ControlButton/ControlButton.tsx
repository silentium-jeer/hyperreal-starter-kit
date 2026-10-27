import type { ReactNode } from 'react'

import styles from './ControlButton.module.css'

export type ControlButtonVariant = 'accent' | 'default'

type ControlButtonProps = {
  readonly active?: boolean
  readonly children: ReactNode
  readonly 'data-testid'?: string
  readonly disabled?: boolean
  readonly label?: string
  readonly onClick?: () => void
  readonly variant?: ControlButtonVariant
}

export function ControlButton({
  active,
  children,
  'data-testid': testId,
  disabled = false,
  label,
  onClick,
  variant = 'default',
}: ControlButtonProps) {
  return (
    <button
      aria-label={label}
      aria-pressed={active}
      className={variant === 'accent' ? styles.accent : styles.button}
      data-testid={testId}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  )
}
