import { post } from '../bridge'
import { ControlChoice, ControlPanel, ControlSlider } from '../features/ui-kit'
import styles from './LabHud.module.css'
import { useGameState } from './useGameState'

type LumenState = { sunPitch: number; sunYaw: number; glow: number; gi: string; reflections: string }
const GI = [
  { id: 'lumen', label: 'Lumen' },
  { id: 'off', label: 'None' },
]
const REFLECTIONS = [
  { id: 'lumen', label: 'Lumen' },
  { id: 'screen', label: 'Screen space' },
  { id: 'off', label: 'None' },
]

export function LumenLabHud() {
  const state = useGameState<LumenState>('lumen/state')
  if (!state) return null
  const moveSun = (pitch: number, yaw: number) => post({ type: 'lumen/sun', pitch, yaw })
  return (
    <div className={styles.corner} data-hit data-testid="lumen-hud">
      <ControlPanel maxWidth={340} title="Light">
        <p className={styles.about}>A closed room lit by the sun through a hole in the ceiling and by a glowing panel. All other light is Lumen bouncing it: switch indirect light off to see what it carries.</p>
        <ControlSlider data-testid="lumen-sun-pitch" format={(pitch) => `${Math.round(-pitch)}°`} label="Sun height" max={-20} min={-89} onChange={(pitch) => moveSun(pitch, state.sunYaw)} step={1} value={state.sunPitch} />
        <ControlSlider data-testid="lumen-sun-yaw" format={(yaw) => `${Math.round(yaw)}°`} label="Sun direction" max={180} min={-180} onChange={(yaw) => moveSun(state.sunPitch, yaw)} step={1} value={state.sunYaw} />
        <ControlSlider data-testid="lumen-glow" format={String} label="Panel glow" max={100} min={0} onChange={(strength) => post({ type: 'lumen/glow', strength })} step={5} value={state.glow} />
      </ControlPanel>
      <ControlPanel maxWidth={340} title="Methods">
        <ControlChoice activeId={state.gi} label="Indirect light" onSelect={(method) => post({ type: 'lumen/gi', method })} options={GI} testIdPrefix="lumen-gi" />
        <ControlChoice activeId={state.reflections} label="Reflections" onSelect={(method) => post({ type: 'lumen/reflections', method })} options={REFLECTIONS} testIdPrefix="lumen-reflections" />
      </ControlPanel>
    </div>
  )
}
