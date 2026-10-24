import { post } from '../bridge'
import { ControlButton, ControlPanel, ControlSlider } from '../features/ui-kit'
import styles from './LabHud.module.css'
import { Readout } from './Readout'
import { useGameState } from './useGameState'

// The physics lab's HUD (dev/src/features/world/labs/physics): the bodies Chaos simulates and the setups to rerun.
type PhysicsState = { rows: number; raining: boolean; everyMs: number; simulating: number; awake: number }

export function PhysicsLabHud() {
  const state = useGameState<PhysicsState>('physics/state')
  if (!state) return null
  return (
    <div className={styles.corner} data-hit data-testid="physics-hud">
      <ControlPanel maxWidth={340} title="Chaos" readout={`${state.awake} awake`}>
        <p className={styles.about}>Rigid bodies declared in React. Bodies that come to rest go to sleep; a push wakes them.</p>
        <Readout rows={[['Bodies', state.simulating], ['Awake', state.awake]]} testId="physics-readout" />
        <ControlButton data-testid="physics-dominoes" onClick={() => post({ type: 'physics/dominoes' })} variant="accent">
          Set up the dominoes again
        </ControlButton>
        <ControlSlider data-testid="physics-rows" format={String} label="Pyramid rows" max={10} min={2} onChange={(rows) => post({ type: 'physics/pyramid', rows })} step={1} value={state.rows} />
        <ControlButton active={state.raining} data-testid="physics-rain" onClick={() => post({ type: 'physics/rain', on: !state.raining })}>
          Sphere rain
        </ControlButton>
        <ControlSlider data-testid="physics-rain-every" format={(ms) => `${(1000 / ms).toFixed(1)}/s`} label="Rain rate" max={1500} min={100} onChange={(everyMs) => post({ type: 'physics/rainEvery', everyMs })} step={50} value={state.everyMs} />
      </ControlPanel>
    </div>
  )
}
