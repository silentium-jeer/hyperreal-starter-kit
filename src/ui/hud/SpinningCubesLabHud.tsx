import { post } from '../bridge'
import { ControlPanel, ControlSlider } from '../features/ui-kit'
import styles from './LabHud.module.css'
import { useGameState } from './useGameState'

type SpinningCubesState = { count: number; speed: number }

export function SpinningCubesLabHud() {
  const state = useGameState<SpinningCubesState>('spinningCubes/state')
  if (!state) return null
  return (
    <div className={styles.corner} data-hit data-testid="spinning-cubes-hud">
      <ControlPanel maxWidth={320} title="Spinning cubes">
        <p className={styles.about}>Actors held by ref and turned every frame from TypeScript; their number is React state.</p>
        <ControlSlider data-testid="spinning-cubes-count" format={String} label="Cubes" max={20} min={1} onChange={(count) => post({ type: 'spinningCubes/count', count })} step={1} value={state.count} />
        <ControlSlider data-testid="spinning-cubes-speed" format={(value) => `${Math.round(value)}°/s`} label="Speed" max={720} min={0} onChange={(degreesPerSecond) => post({ type: 'spinningCubes/speed', degreesPerSecond })} step={10} value={state.speed} />
      </ControlPanel>
    </div>
  )
}
