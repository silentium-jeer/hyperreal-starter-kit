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

// Frames per second, smoothed over the last frames, for a HUD readout.
export function useSmoothedFps() {
  const fps = useRef(0);
  useFrame((deltaSeconds) => {
    if (deltaSeconds <= 0) return;
    const now = 1 / deltaSeconds;
    fps.current = fps.current ? fps.current * 0.95 + now * 0.05 : now;
  });
  return fps;
}
