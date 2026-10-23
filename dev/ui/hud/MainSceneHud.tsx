import { useEffect, useState } from 'react'

import { onGameMessage, post } from '../bridge'
import { ControlButton, ControlPanel, ControlSlider } from '../features/ui-kit'
import styles from './MainSceneHud.module.css'

type MainSceneState = { fps: number; sunPitch: number; raining: boolean }

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
    <div className={styles.corner} data-hit data-testid="main-scene-hud">
      <ControlPanel maxWidth={300} readout={`${state.fps} FPS`} title="Scene">
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
  )
}
