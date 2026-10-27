import { post } from '../bridge'
import { ControlButton, ControlPanel, ControlSlider } from '../features/ui-kit'
import styles from './LabHud.module.css'
import { Readout } from './Readout'
import { useGameState } from './useGameState'

type PlaygroundState = { steps: number; rows: number; speed: number; mode: string }

export function PlaygroundLabHud() {
  const state = useGameState<PlaygroundState>('playground/state')
  if (!state) return null
  return (
    <div className={styles.corner} data-hit data-testid="playground-hud">
      <ControlPanel maxWidth={320} title="Player" readout={state.mode}>
        <p className={styles.about}>The stock Mannequin on a character with CharacterMovement. WASD and Space, or a gamepad; click the game to take the mouse.</p>
        <Readout rows={[['Speed', `${state.speed} cm/s`], ['Movement', state.mode]]} testId="playground-readout" />
      </ControlPanel>
      <ControlPanel maxWidth={320} title="Course">
        <ControlSlider data-testid="playground-steps" format={String} label="Stairs" max={30} min={2} onChange={(steps) => post({ type: 'playground/steps', steps })} step={1} value={state.steps} />
        <ControlSlider data-testid="playground-rows" format={String} label="Pyramid rows" max={10} min={1} onChange={(rows) => post({ type: 'playground/rows', rows })} step={1} value={state.rows} />
        <ControlButton data-testid="playground-reset" onClick={() => post({ type: 'playground/reset' })} variant="accent">
          Start again
        </ControlButton>
      </ControlPanel>
    </div>
  )
}
