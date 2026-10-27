import { post } from '../bridge'
import { ControlButton, ControlChoice, ControlPanel } from '../features/ui-kit'
import styles from './LabHud.module.css'
import { Readout } from './Readout'
import { useGameState } from './useGameState'

type MannequinState = { clips: string[]; clip: string; cycling: boolean; time: number; length: number }

export function MannequinLabHud() {
  const state = useGameState<MannequinState>('mannequin/state')
  if (!state) return null
  return (
    <div className={styles.corner} data-hit data-testid="mannequin-hud">
      <ControlPanel maxWidth={340} title="Clips" readout={state.clip}>
        <p className={styles.about}>The stock Mannequin playing the template's unarmed clips by name, without an Animation Blueprint.</p>
        <ControlChoice activeId={state.clip} label="Clip" onSelect={(clip) => post({ type: 'mannequin/clip', clip })} options={state.clips.map((clip) => ({ id: clip, label: clip }))} testIdPrefix="mannequin-clip" />
        <ControlButton active={state.cycling} data-testid="mannequin-cycle" onClick={() => post({ type: 'mannequin/cycle', on: !state.cycling })}>
          Cycle every 3 s
        </ControlButton>
        <Readout rows={[['Time', `${state.time.toFixed(2)} / ${state.length.toFixed(2)} s`]]} testId="mannequin-readout" />
      </ControlPanel>
    </div>
  )
}
