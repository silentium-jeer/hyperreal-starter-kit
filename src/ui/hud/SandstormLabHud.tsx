import { post } from '../bridge'
import { ControlButton, ControlChoice, ControlPanel } from '../features/ui-kit'
import styles from './LabHud.module.css'
import { useGameState } from './useGameState'

type SandstormState = { resolution: number; resolutions: number[] }

export function SandstormLabHud() {
  const state = useGameState<SandstormState>('sandstorm/state')
  if (!state) return null
  return (
    <div className={styles.corner} data-hit data-testid="sandstorm-hud">
      <ControlPanel maxWidth={340} title="Sandstorm">
        <p className={styles.about}>Niagara Fluids 3D gas from Epic's smoke template, set up in TypeScript as a wall of sand. Grid resolution changes live.</p>
        <ControlChoice activeId={String(state.resolution)} label="Grid cells" onSelect={(cells) => post({ type: 'sandstorm/resolution', cells: Number(cells) })} options={state.resolutions.map((cells) => ({ id: String(cells), label: String(cells) }))} testIdPrefix="sandstorm-resolution" />
        <ControlButton data-testid="sandstorm-restart" onClick={() => post({ type: 'sandstorm/restart' })}>
          Restart the storm
        </ControlButton>
      </ControlPanel>
    </div>
  )
}
