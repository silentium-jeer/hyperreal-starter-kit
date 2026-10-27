import { post } from '../bridge'
import { ControlChoice, ControlPanel } from '../features/ui-kit'
import styles from './LabHud.module.css'
import { Readout } from './Readout'
import { useGameState } from './useGameState'

type MixamoCharacterState = { clips: string[]; clip: string; mesh: string; skeleton: string; bones: number; animation: string; time: number; importing: boolean }
const objectName = (path: string) => (path ? path.slice(path.lastIndexOf('.') + 1) : '—')

export function MixamoCharacterLabHud() {
  const state = useGameState<MixamoCharacterState>('mixamoCharacter/state')
  if (!state) return null
  return (
    <div className={styles.corner} data-hit data-testid="mixamo-character-hud">
      <ControlPanel maxWidth={340} title="Mixamo character" readout={state.importing ? 'importing' : state.clip}>
        <p className={styles.about}>The standard Mixamo mannequin (With Skin) and Mixamo clips downloaded for it (Without Skin), all FBX. Each clip is imported onto the model's skeleton by its import line.</p>
        <ControlChoice activeId={state.clip} label="Clip" onSelect={(clip) => post({ type: 'mixamoCharacter/clip', clip })} options={state.clips.map((clip) => ({ id: clip, label: clip }))} testIdPrefix="mixamo-character-clip" />
        <Readout
          rows={[
            ['Mesh', objectName(state.mesh)],
            ['Skeleton', objectName(state.skeleton)],
            ['Bones', state.bones],
            ['Animation', objectName(state.animation)],
            ['Time', `${state.time.toFixed(2)} s`],
          ]}
          testId="mixamo-character-readout"
        />
      </ControlPanel>
    </div>
  )
}
