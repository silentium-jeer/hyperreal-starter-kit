import { post } from '../bridge'
import { ControlPanel, ControlSlider } from '../features/ui-kit'
import styles from './LabHud.module.css'
import { Readout } from './Readout'
import { useGameState } from './useGameState'

// The flight case lab's HUD (dev/src/features/demo/labs/flight-case): which build of the model file is on screen.
type FlightCaseState = { turn: number; build: number | null; mesh: string; ready: boolean }

export function FlightCaseLabHud() {
  const state = useGameState<FlightCaseState>('flightCase/state')
  if (!state) return null
  return (
    <div className={styles.corner} data-hit data-testid="flight-case-hud">
      <ControlPanel maxWidth={340} title="Live asset" readout={state.ready ? `build ${state.build}` : 'importing'}>
        <p className={styles.about}>features/demo/assets/flight-case.glb, imported by the content pipeline. Save the file and the new build replaces the mesh here.</p>
        <Readout rows={[['Mesh', state.mesh || '—'], ['Build', state.build ?? '—']]} testId="flight-case-readout" />
        <ControlSlider data-testid="flight-case-turn" format={(value) => `${Math.round(value)}°/s`} label="Turntable" max={180} min={0} onChange={(degreesPerSecond) => post({ type: 'flightCase/turn', degreesPerSecond })} step={1} value={state.turn} />
      </ControlPanel>
    </div>
  )
}
