import { post } from '../bridge'
import { ControlPanel, ControlSlider } from '../features/ui-kit'
import styles from './LabHud.module.css'
import { Readout } from './Readout'
import { useGameState } from './useGameState'

type InstancingState = { side: number; elements: number; components: number[]; fps: number }

export function InstancingLabHud() {
  const state = useGameState<InstancingState>('instancing/state')
  if (!state) return null
  const instances = state.components.reduce((sum, count) => sum + count, 0)
  return (
    <div className={styles.corner} data-hit data-testid="instancing-hud">
      <ControlPanel maxWidth={340} title="Instancing" readout={`${state.fps} FPS`}>
        <p className={styles.about}>Every cube is an ordinary static mesh element in React. The renderer packs them into one instanced component per mesh and material, the way a Packed Level Actor packs a level.</p>
        <ControlSlider data-testid="instancing-side" format={(side) => `${side * side}`} label="Elements" max={80} min={10} onChange={(side) => post({ type: 'instancing/side', side })} step={5} value={state.side} />
        <Readout
          rows={[
            ['Elements', state.elements],
            ['Instanced components', state.components.length],
            ['Instances', instances],
          ]}
          testId="instancing-readout"
        />
      </ControlPanel>
    </div>
  )
}
