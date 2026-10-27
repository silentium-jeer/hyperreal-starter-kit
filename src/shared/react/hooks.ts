import { useEffect, useRef } from 'react';
import { fixedStep, type FixedStep } from '../engine/fixedStep';
import { onFrame, type FrameOptions } from '../engine/world';

export function useFrame(callback: (deltaSeconds: number) => void, { tickEvenWhenPaused = false }: FrameOptions = {}) {
  const latest = useRef(callback);
  latest.current = callback;
  useEffect(() => onFrame((deltaSeconds) => latest.current(deltaSeconds), { tickEvenWhenPaused }), [tickEvenWhenPaused]);
}

export function useEvery(milliseconds: number, callback: () => void) {
  const latest = useRef(callback);
  latest.current = callback;
  useEffect(() => {
    let elapsed = 0;
    return onFrame((deltaSeconds) => {
      elapsed += deltaSeconds * 1000;
      while (elapsed >= milliseconds) {
        elapsed -= milliseconds;
        latest.current();
      }
    });
  }, [milliseconds]);
}

export function useAfter(milliseconds: number, callback: () => void) {
  const latest = useRef(callback);
  latest.current = callback;
  useEffect(() => {
    let elapsed = 0;
    let fired = false;
    return onFrame((deltaSeconds) => {
      elapsed += deltaSeconds * 1000;
      if (fired || elapsed < milliseconds) return;
      fired = true;
      latest.current();
    });
  }, [milliseconds]);
}

export function useFixedStep(stepsPerSecond: number, step: (stepSeconds: number) => void, draw?: (alpha: number) => void) {
  const latest = useRef({ step, draw });
  latest.current = { step, draw };
  const running = useRef<FixedStep | undefined>(undefined);
  useEffect(() => {
    running.current = fixedStep(stepsPerSecond, (seconds) => latest.current.step(seconds), { draw: (alpha) => latest.current.draw?.(alpha) });
    return () => running.current?.stop();
  }, [stepsPerSecond]);
  return running;
}

export function useSmoothedFps() {
  const fps = useRef(0);
  useFrame((deltaSeconds) => {
    if (deltaSeconds <= 0) return;
    const now = 1 / deltaSeconds;
    fps.current = fps.current ? fps.current * 0.95 + now * 0.05 : now;
  });
  return fps;
}
