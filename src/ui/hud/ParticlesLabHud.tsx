import { post } from '../bridge'
import { ControlChoice, ControlPanel, ControlSlider } from '../features/ui-kit'
import styles from './LabHud.module.css'
import { useGameState } from './useGameState'

type ParticlesState = { rate: number; tint: string; tints: string[] }

export function ParticlesLabHud() {
  const state = useGameState<ParticlesState>('particles/state')
  if (!state) return null
  return (
    <div className={styles.corner} data-hit data-testid="particles-hud">
      <ControlPanel maxWidth={340} title="Particles">
        <p className={styles.about}>Niagara systems built from TypeScript. The sparks' rate and colour are user parameters: no rebuild.</p>
        <ControlSlider data-testid="particles-rate" format={(value) => `${Math.round(value)}/s`} label="Spark rate" max={20000} min={100} onChange={(rate) => post({ type: 'particles/rate', rate })} step={100} value={state.rate} />
        <ControlChoice activeId={state.tint} label="Tint" onSelect={(tint) => post({ type: 'particles/tint', tint })} options={state.tints.map((id) => ({ id, label: id }))} testIdPrefix="particles-tint" />
      </ControlPanel>
    </div>
  )
}
