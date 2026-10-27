import styles from './ControlSlider.module.css'

type ControlSliderProps = {
  readonly 'data-testid'?: string
  readonly disabled?: boolean
  readonly label: string
  readonly max?: number
  readonly min?: number
  readonly onChange: (value: number) => void
  readonly step?: number
  readonly value: number
  readonly format?: (value: number) => string
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`
}

export function ControlSlider({
  'data-testid': testId,
  disabled = false,
  format = percent,
  label,
  max = 1,
  min = 0,
  onChange,
  step = 0.05,
  value,
}: ControlSliderProps) {
  const span = max - min
  const fill = span > 0 ? ((value - min) / span) * 100 : 0

  return (
    <label className={styles.row}>
      <span className={styles.label}>{label}</span>
      <input
        aria-label={label}
        className={styles.input}
        data-testid={testId}
        disabled={disabled}
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.target.value))}
        step={step}
        style={{ '--fill': `${fill}%` } as React.CSSProperties}
        type="range"
        value={value}
      />
      <output className={styles.value}>{format(value)}</output>
    </label>
  )
}
