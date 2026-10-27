import { post } from '../bridge'
import { ControlPanel, ControlSlider } from '../features/ui-kit'
import styles from './LabHud.module.css'
import { useGameState } from './useGameState'

type FixedStepState = { stepsPerSecond: number; speed: number; fps: number; steps: number }

export function FixedStepLabHud() {
  const state = useGameState<FixedStepState>('fixedStep/state')
  if (!state) return null
  return (
    <div className={styles.corner} data-hit data-testid="fixed-step-hud">
      <ControlPanel maxWidth={340} readout={`${state.fps} FPS`} title="Fixed step">
        <p className={styles.about}>Green: fixed steps drawn interpolated. Orange: the same steps drawn raw. Red: steps from a script timer.</p>
        <ControlSlider data-testid="fixed-step-rate" format={(value) => `${Math.round(value)} Hz`} label="Steps" max={60} min={10} onChange={(stepsPerSecond) => post({ type: 'fixedStep/rate', stepsPerSecond })} step={5} value={state.stepsPerSecond} />
        <ControlSlider data-testid="fixed-step-speed" format={(value) => `${Math.round(value)} cm/s`} label="Speed" max={2000} min={100} onChange={(speed) => post({ type: 'fixedStep/speed', speed })} step={100} value={state.speed} />
      </ControlPanel>
    </div>
  )
}
