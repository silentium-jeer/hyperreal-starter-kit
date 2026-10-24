import { useState } from 'react';
import { LabStage } from '../../../../scenes/lab-stage/LabStage';
import { useHudMessages, useHudState } from '../../../../shared/react';
import { SpinningCubes } from '../../entities/SpinningCubes';

// Cubes turned every frame from TS (actors held by ref, moved in useFrame). Its HUD
// (dev/ui/hud/SpinningCubesLabHud.tsx) sets how many cubes there are and how fast they turn.
export function Scene() {
  const [count, setCount] = useState(5);
  const [speed, setSpeed] = useState(90);

  useHudMessages((message) => {
    if (message.type === 'spinningCubes/count') setCount(Number(message.count));
    if (message.type === 'spinningCubes/speed') setSpeed(Number(message.degreesPerSecond));
  });
  useHudState('spinningCubes/state', () => ({ count, speed }));

  return (
    <>
      <LabStage />
      <SpinningCubes at={[0, 0, 100]} count={count} degreesPerSecond={speed} />
    </>
  );
}
