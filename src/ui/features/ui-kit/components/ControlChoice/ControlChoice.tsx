import { ControlButton } from '../ControlButton/ControlButton'
import styles from './ControlChoice.module.css'

export type ControlChoiceOption = Readonly<{
  disabled?: boolean
  id: string
  label: string
}>

type ControlChoiceProps = {
  readonly activeId: string
  readonly label: string
  readonly onSelect: (id: string) => void
  readonly options: readonly ControlChoiceOption[]
  readonly testIdPrefix?: string
}

export function ControlChoice({ activeId, label, onSelect, options, testIdPrefix = 'choice' }: ControlChoiceProps) {
  return (
    <div aria-label={label} className={styles.row} data-testid={`${testIdPrefix}-group`} role="radiogroup">
      {options.map((option) => (
        <ControlButton
          active={option.id === activeId}
          data-testid={`${testIdPrefix}-${option.id}`}
          disabled={option.disabled}
          key={option.id}
          onClick={() => onSelect(option.id)}
        >
          {option.label}
        </ControlButton>
      ))}
    </div>
  )
}
