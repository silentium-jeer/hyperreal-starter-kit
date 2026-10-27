import { post } from '../bridge'
import { ControlPanel, ControlSlider } from '../features/ui-kit'
import styles from './LabHud.module.css'
import { Readout } from './Readout'
import { useGameState } from './useGameState'

type MaterialInfo = { class: string; path: string; parent: string | null; glowStrength?: number } | null
type MaterialsState = {
  glow: number
  tint: [number, number, number]
  sphere: MaterialInfo
  packed: { mesh: string; instances: number; material: MaterialInfo }[]
}

const assetName = (path: string | null | undefined) => (path ? path.slice(path.lastIndexOf('.') + 1) : '—')

export function MaterialsLabHud() {
  const state = useGameState<MaterialsState>('materials/state')
  if (!state) return null
  const setTint = (channel: number, value: number) => post({ type: 'materials/tint', color: state.tint.map((current, i) => (i === channel ? value : current)) })
  return (
    <>
      <div className={styles.corner} data-hit data-testid="materials-hud">
        <ControlPanel maxWidth={340} title="Dynamic instance">
          <p className={styles.about}>The sphere draws a dynamic instance of the lava material: its values change at once, without compiling. Edit features/materials/assets/lava.material.tsx and save to rebuild the material itself.</p>
          <ControlSlider data-testid="materials-glow" format={String} label="Glow" max={100} min={0} onChange={(strength) => post({ type: 'materials/glow', strength })} step={1} value={state.glow} />
          {(['Red', 'Green', 'Blue'] as const).map((label, channel) => (
            <ControlSlider data-testid={`materials-tint-${label.toLowerCase()}`} format={(value) => value.toFixed(2)} key={label} label={label} max={1} min={0} onChange={(value) => setTint(channel, value)} step={0.01} value={state.tint[channel]} />
          ))}
        </ControlPanel>
      </div>
      <div className={styles.rightCorner} data-hit data-testid="materials-meshes">
        <ControlPanel maxWidth={360} title="On the meshes">
          <Readout
            rows={[
              ['Sphere', `${state.sphere?.class ?? '—'} of ${assetName(state.sphere?.parent)}`],
              ...state.packed.map(({ instances, material }, i): [string, string] => [`Packed group ${i + 1} (${instances})`, `${material?.class ?? '—'} ${assetName(material?.path)}`]),
            ]}
            testId="materials-readout"
          />
        </ControlPanel>
      </div>
    </>
  )
}
