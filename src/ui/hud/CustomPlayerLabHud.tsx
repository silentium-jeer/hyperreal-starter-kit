import { post } from '../bridge'
import { ControlChoice, ControlPanel } from '../features/ui-kit'
import styles from './LabHud.module.css'
import { Readout } from './Readout'
import { useGameState } from './useGameState'

type CustomPlayerState = {
  body: 'mixamo' | 'manny'
  ready: boolean
  mesh: string
  clips: { idleWalkRun: string; jump: string; fall: string; land: string } | null
  retargeted: number
  speed: number
}
const BODIES = [
  { id: 'mixamo', label: 'Mixamo mannequin' },
  { id: 'manny', label: 'Manny' },
]
const objectName = (path: string | undefined) => (path ? path.slice(path.lastIndexOf('.') + 1) : '—')

export function CustomPlayerLabHud() {
  const state = useGameState<CustomPlayerState>('customPlayer/state')
  if (!state) return null
  return (
    <div className={styles.corner} data-hit data-testid="custom-player-hud">
      <ControlPanel maxWidth={340} title="Player body" readout={state.body === 'mixamo' && !state.ready ? 'retargeting' : `${state.speed} cm/s`}>
        <p className={styles.about}>The same player, controls and locomotion graph on another body: Manny's unarmed set retargeted onto the Mixamo mannequin.</p>
        <ControlChoice activeId={state.body} label="Body" onSelect={(body) => post({ type: 'customPlayer/body', body })} options={BODIES} testIdPrefix="custom-player-body" />
        <Readout
          rows={[
            ['Mesh', objectName(state.mesh)],
            ['Locomotion', objectName(state.clips?.idleWalkRun)],
            ['Jump / fall / land', state.clips ? [state.clips.jump, state.clips.fall, state.clips.land].map(objectName).join(' / ') : '—'],
            ['Retargeted assets', state.retargeted],
          ]}
          testId="custom-player-readout"
        />
      </ControlPanel>
    </div>
  )
}
