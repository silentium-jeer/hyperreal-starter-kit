import { ControlButton } from '../ControlButton/ControlButton'
import { ControlSlider } from '../ControlSlider/ControlSlider'
import styles from './AudioSettingsControls.module.css'

export type AudioSettingsValues = {
  readonly master: number
  readonly music: number
  readonly sfx: number
  readonly muted: boolean
}

type AudioSettingsControlsProps = {
  readonly 'data-testid'?: string
  readonly onChange: (patch: Partial<AudioSettingsValues>) => void
  readonly values: AudioSettingsValues
}

export function AudioSettingsControls({
  'data-testid': testId,
  onChange,
  values,
}: AudioSettingsControlsProps) {
  return (
    <div className={styles.group} data-testid={testId}>
      <ControlSlider
        data-testid="audio-master"
        disabled={values.muted}
        label="Master"
        onChange={(master) => onChange({ master })}
        value={values.master}
      />
      <ControlSlider
        data-testid="audio-music"
        disabled={values.muted}
        label="Music"
        onChange={(music) => onChange({ music })}
        value={values.music}
      />
      <ControlSlider
        data-testid="audio-sfx"
        disabled={values.muted}
        label="Effects"
        onChange={(sfx) => onChange({ sfx })}
        value={values.sfx}
      />
      <div className={styles.actions}>
        <ControlButton
          active={values.muted}
          data-testid="audio-mute"
          onClick={() => onChange({ muted: !values.muted })}
        >
          {values.muted ? 'Muted' : 'Mute all'}
        </ControlButton>
      </div>
    </div>
  )
}
