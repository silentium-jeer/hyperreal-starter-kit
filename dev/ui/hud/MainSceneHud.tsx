import { useEffect, useState } from 'react'

import { onGameMessage, post } from '../bridge'
import { ControlButton, ControlChoice, ControlPanel, ControlSlider } from '../features/ui-kit'
import styles from './MainSceneHud.module.css'

type MainSceneState = { fps: number; sunPitch: number; raining: boolean; quality: number }

// The engine's scalability levels; the game reports -1 when its groups are set to different levels.
const QUALITY_LEVELS = [
  { id: '0', label: 'Low' },
  { id: '1', label: 'Medium' },
  { id: '2', label: 'High' },
  { id: '3', label: 'Epic' },
  { id: '4', label: 'Cinematic' },
]

const SUN_HIGHEST = -80
const SUN_LOWEST = -5

function useMainSceneState() {
  const [state, setState] = useState<MainSceneState>()
  useEffect(() => {
    const stopListening = onGameMessage((message) => {
      if (message.type === 'main/state') setState(message as unknown as MainSceneState)
    })
    return () => {
      stopListening()
    }
  }, [])
  return state
}

export function MainSceneHud() {
  const state = useMainSceneState()
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
        </ControlPanel>
      </div>
    </>
  )
}
