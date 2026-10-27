import { post } from '../bridge'
import { ControlChoice, ControlPanel, ControlSlider } from '../features/ui-kit'
import styles from './LabHud.module.css'
import { Readout } from './Readout'
import { useGameState } from './useGameState'

type NaniteState = { side: number; copies: number; view: string; fps: number }
const VIEWS = [
  { id: 'off', label: 'Shaded' },
  { id: 'triangles', label: 'Triangles' },
  { id: 'clusters', label: 'Clusters' },
  { id: 'overview', label: 'Overview' },
]

export function NaniteLabHud() {
  const state = useGameState<NaniteState>('nanite/state')
  if (!state) return null
  return (
    <div className={styles.corner} data-hit data-testid="nanite-hud">
      <ControlPanel maxWidth={340} title="Nanite" readout={`${state.fps} FPS`}>
        <p className={styles.about}>Copies of the imported flight case in one instanced component. Nanite draws the triangles the screen needs, not the ones the mesh has: switch to Triangles and fly closer.</p>
        <ControlSlider data-testid="nanite-copies" format={(side) => `${(side * side).toLocaleString('en')}`} label="Copies" max={150} min={10} onChange={(side) => post({ type: 'nanite/side', side })} step={10} value={state.side} />
        <ControlChoice activeId={state.view} label="View" onSelect={(view) => post({ type: 'nanite/view', view })} options={VIEWS} testIdPrefix="nanite-view" />
        <Readout rows={[['Copies', state.copies.toLocaleString('en')]]} testId="nanite-readout" />
      </ControlPanel>
    </div>
  )
}
