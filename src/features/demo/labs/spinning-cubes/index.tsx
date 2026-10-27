import { useState } from 'react';
import { LabStage } from '../../../../scenes/lab-stage/LabStage';
import { useHudMessages, useHudState } from '../../../../shared/react';
import { SpinningCubes } from '../../entities/SpinningCubes';

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
