import { useEffect, useState } from 'react'

import { onGameMessage } from '../bridge'

// The last state a scene reports to the HUD under `type`. Scenes send their state a few times a second; when the scene
// that sends it is gone (another scene opened in the same game), the state goes stale and the hook returns undefined,
// so that scene's panels leave with it.
const STALE_AFTER_MS = 1000

export function useGameState<T>(type: string): T | undefined {
  const [state, setState] = useState<{ value: T; at: number }>()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const stopListening = onGameMessage((message) => {
      if (message.type === type) setState({ value: message as unknown as T, at: Date.now() })
    })
    const timer = setInterval(() => setNow(Date.now()), STALE_AFTER_MS / 2)
    return () => {
      stopListening()
      clearInterval(timer)
    }
  }, [type])
  return state && now - state.at < STALE_AFTER_MS ? state.value : undefined
}
