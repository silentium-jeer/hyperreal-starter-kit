import { useEffect, useState } from 'react'

import { onGameMessage } from '../bridge'

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
