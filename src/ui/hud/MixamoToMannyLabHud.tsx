import { post } from '../bridge'
import { ControlChoice, ControlPanel } from '../features/ui-kit'
import styles from './LabHud.module.css'
import { Readout } from './Readout'
import { useGameState } from './useGameState'

type MixamoToMannyState = { clips: string[]; clip: string; source: string; retargeted: string; importing: boolean }
const objectPath = (path: string) => (path ? path.replace(/\.[^.]+$/, '') : '—')

export function MixamoToMannyLabHud() {
  const state = useGameState<MixamoToMannyState>('mixamoToManny/state')
  if (!state) return null
  return (
    <div className={styles.corner} data-hit data-testid="mixamo-to-manny-hud">
      <ControlPanel maxWidth={360} title="Mixamo clip on Manny" readout={state.importing ? 'retargeting' : state.clip}>
        <p className={styles.about}>Left: the Mixamo mannequin plays the clip as downloaded. Right: Manny plays it retargeted onto his skeleton by an IK Retargeter the content service generated.</p>
        <ControlChoice activeId={state.clip} label="Clip" onSelect={(clip) => post({ type: 'mixamoToManny/clip', clip })} options={state.clips.map((clip) => ({ id: clip, label: clip }))} testIdPrefix="mixamo-to-manny-clip" />
        <Readout
          rows={[
            ['Mixamo', objectPath(state.source)],
            ['Manny', objectPath(state.retargeted)],
          ]}
          testId="mixamo-to-manny-readout"
        />
      </ControlPanel>
    </div>
  )
}
