import { useEffect, useRef } from 'react';
import { gameInstance } from '../engine/world';

// Runs `callback` once per engine frame (UVgeGameInstance.OnTick, before the world ticks) while the calling
// component is mounted. The latest callback runs, so it can read the latest props and state.
export function useFrame(callback: (deltaSeconds: number) => void) {
  const latest = useRef(callback);
  latest.current = callback;
  useEffect(() => {
    let reported = false;
    const tick = (deltaSeconds: number) => {
      try {
        latest.current(deltaSeconds);
      } catch (err: any) {
        if (!reported) console.error(`[react] frame callback failed: ${err?.stack ?? err}`);
        reported = true;
      }
    };
    gameInstance.OnTick.Add(tick);
    return () => gameInstance.OnTick.Remove(tick);
  }, []);
}
