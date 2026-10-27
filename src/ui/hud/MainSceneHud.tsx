import { useState } from 'react'

import { post } from '../bridge'
import { ControlButton, ControlChoice, ControlPanel, ControlSlider } from '../features/ui-kit'
import styles from './MainSceneHud.module.css'
import { useGameState } from './useGameState'

type MainSceneState = { fps: number; sunPitch: number; raining: boolean; quality: number; frameRateLimit: number; vsync: boolean }

const FRAME_RATE_LIMITS = [
  { id: '30', label: '30' },
  { id: '60', label: '60' },
  { id: '120', label: '120' },
  { id: '0', label: 'No limit' },
]

const QUALITY_LEVELS = [
  { id: '0', label: 'Low' },
  { id: '1', label: 'Medium' },
  { id: '2', label: 'High' },
  { id: '3', label: 'Epic' },
  { id: '4', label: 'Cinematic' },
]

const SUN_HIGHEST = -80
const SUN_LOWEST = -5

export function MainSceneHud() {
  const state = useGameState<MainSceneState>('main/state')
  const [sunPitch, setSunPitch] = useState<number>()

  if (!state) return null
  const shownPitch = sunPitch ?? state.sunPitch
  const moveSun = (pitch: number) => {
    setSunPitch(pitch)
    post({ type: 'main/sun', pitch })
  }

  return (
    <>
      <div className={styles.corner} data-hit data-testid="main-scene-hud">
        <ControlPanel maxWidth={300} title="Scene">
          <ControlSlider
            data-testid="hud-sun"
            format={(pitch) => `${Math.round(-pitch)}°`}
            label="Sun"
            max={SUN_LOWEST}
            min={SUN_HIGHEST}
            onChange={moveSun}
            step={1}
            value={shownPitch}
          />
          <ControlButton active={state.raining} data-testid="hud-rain" onClick={() => post({ type: 'main/rain', on: !state.raining })} variant="accent">
            Sphere rain
          </ControlButton>
        </ControlPanel>
      </div>
      <div className={styles.rightCorner} data-hit data-testid="main-quality-hud">
        <ControlPanel maxWidth={300} readout={`${state.fps} FPS`} title="Quality">
          <ControlChoice
            activeId={String(state.quality)}
            label="Quality"
            onSelect={(level) => post({ type: 'main/quality', level: Number(level) })}
            options={QUALITY_LEVELS}
            testIdPrefix="hud-quality"
          />
          <ControlChoice
            activeId={String(state.frameRateLimit)}
            label="Frame rate limit"
            onSelect={(limit) => post({ type: 'main/frameRateLimit', limit: Number(limit) })}
            options={FRAME_RATE_LIMITS}
            testIdPrefix="hud-frame-rate"
          />
          <ControlButton active={state.vsync} data-testid="hud-vsync" onClick={() => post({ type: 'main/vsync', on: !state.vsync })}>
            VSync
          </ControlButton>
        </ControlPanel>
      </div>
    </>
  )
}
