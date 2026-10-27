import type { ReactNode } from 'react'

import { ControlChoice } from '../ControlChoice/ControlChoice'
import styles from './VideoSettingsControls.module.css'

function LabelledRow({ children, label }: { readonly children: ReactNode; readonly label: string }) {
  return (
    <div className={styles.row}>
      <span className={styles.label}>{label}</span>
      <div className={styles.control}>{children}</div>
    </div>
  )
}

export type VideoSettingsValues = {
  readonly quality: string
  readonly frameCap: number
  readonly shadows: string
}

export type VideoSettingsOption = {
  readonly id: string
  readonly label: string
}

type VideoSettingsControlsProps = {
  readonly 'data-testid'?: string
  readonly frameCaps: readonly number[]
  readonly onChange: (patch: Partial<VideoSettingsValues>) => void
  readonly qualities: readonly VideoSettingsOption[]
  readonly shadowModes: readonly VideoSettingsOption[]
  readonly values: VideoSettingsValues
}

export function VideoSettingsControls({
  'data-testid': testId,
  frameCaps,
  onChange,
  qualities,
  shadowModes,
  values,
}: VideoSettingsControlsProps) {
  return (
    <div className={styles.group} data-testid={testId}>
      <LabelledRow label="Quality">
        <ControlChoice
          activeId={values.quality}
          label="Quality"
          onSelect={(quality) => onChange({ quality })}
          options={[...qualities]}
          testIdPrefix="video-quality"
        />
      </LabelledRow>
      <LabelledRow label="Shadows">
        <ControlChoice
          activeId={values.shadows}
          label="Shadows"
          onSelect={(shadows) => onChange({ shadows })}
          options={[...shadowModes]}
          testIdPrefix="video-shadows"
        />
      </LabelledRow>
      <LabelledRow label="Frame cap">
        <ControlChoice
          activeId={String(values.frameCap)}
          label="Frame cap"
          onSelect={(id) => onChange({ frameCap: Number(id) })}
          options={frameCaps.map((cap) => ({ id: String(cap), label: cap === 0 ? 'Off' : String(cap) }))}
          testIdPrefix="video-framecap"
        />
      </LabelledRow>
    </div>
  )
}
