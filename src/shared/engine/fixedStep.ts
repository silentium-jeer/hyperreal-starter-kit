import * as UE from 'ue';
import { everyFrame, world, type Scope } from './world';

export interface FixedStep {
  readonly alpha: number;
  readonly steps: number;
  stop(): void;
}

export interface FixedStepOptions {
  maxStepsPerFrame?: number;
  draw?: (alpha: number) => void;
  scope?: Scope;
}

export function fixedStep(stepsPerSecond: number, step: (stepSeconds: number) => void, { maxStepsPerFrame = 8, draw, scope = 'scene' }: FixedStepOptions = {}): FixedStep {
  const stepSeconds = 1 / stepsPerSecond;
  let previous = UE.GameplayStatics.GetTimeSeconds(world);
  let accumulated = 0;
  const state = { alpha: 0, steps: 0, stop: () => {} };
  state.stop = everyFrame(() => {
    const now = UE.GameplayStatics.GetTimeSeconds(world);
    accumulated += Math.max(0, now - previous);
    previous = now;
    let run = 0;
    while (accumulated >= stepSeconds && run < maxStepsPerFrame) {
      step(stepSeconds);
      accumulated -= stepSeconds;
      state.steps++;
      run++;
    }
    if (run === maxStepsPerFrame) accumulated = Math.min(accumulated, stepSeconds);
    state.alpha = accumulated / stepSeconds;
    draw?.(state.alpha);
  }, scope);
  return state;
}
