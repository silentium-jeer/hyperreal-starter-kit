import * as UE from 'ue';
import { $ref } from 'puerts';
import { useEffect, useRef, useState } from 'react';
import { LabStage } from '../../../../scenes/lab-stage/LabStage';
import { colored, every } from '../../../../shared/engine/world';
import { useFixedStep, useHudMessages, useHudState, useSmoothedFps } from '../../../../shared/react';

const CUBE = '/Engine/BasicShapes/Cube.Cube';
const RANGE = 700;
const ROWS = [
  { name: 'interpolated', y: -300, color: [0.1, 0.7, 0.3] as const },
  { name: 'raw steps', y: 0, color: [0.9, 0.6, 0.1] as const },
  { name: 'timer', y: 300, color: [0.85, 0.15, 0.1] as const },
];

const bounce = (distance: number) => {
  const phase = ((distance % (4 * RANGE)) + 4 * RANGE) % (4 * RANGE);
  return phase < 2 * RANGE ? phase - RANGE : 3 * RANGE - phase;
};

const ignoredHit = $ref(new UE.HitResult());

interface Track {
  previous: number;
  current: number;
}

export function Scene() {
  const [stepsPerSecond, setStepsPerSecond] = useState(30);
  const [speed, setSpeed] = useState(600);
  const fps = useSmoothedFps();
  const cubes = useRef<(UE.StaticMeshActor | null)[]>([]);
  const fixed = useRef<Track>({ previous: 0, current: 0 });
  const timed = useRef<Track>({ previous: 0, current: 0 });
  const moves = useRef<number[][]>([[], [], []]);
  const drawn = useRef([0, 0, 0]);

  useEffect(
    () =>
      every(1000 / stepsPerSecond, () => {
        timed.current.previous = timed.current.current;
        timed.current.current += speed / stepsPerSecond;
      }),
    [stepsPerSecond, speed],
  );

  const running = useFixedStep(
    stepsPerSecond,
    (seconds) => {
      fixed.current.previous = fixed.current.current;
      fixed.current.current += speed * seconds;
    },
    (alpha) => place(alpha),
  );

  const place = (alpha: number) => {
    const at = [
      bounce(fixed.current.previous + (fixed.current.current - fixed.current.previous) * alpha),
      bounce(fixed.current.current),
      bounce(timed.current.current),
    ];
    at.forEach((x, i) => {
      const record = moves.current[i];
      record.push(Math.abs(x - drawn.current[i]));
      if (record.length > 240) record.shift();
      drawn.current[i] = x;
      cubes.current[i]?.K2_SetActorLocation(new UE.Vector(x, ROWS[i].y, 100), false, ignoredHit, false);
    });
  };

  (globalThis as any).fixedStepLab = {
    report: () =>
      Object.fromEntries(
        ROWS.map((row, i) => {
          const record = moves.current[i].filter((move) => move < RANGE);
          const mean = record.reduce((sum, move) => sum + move, 0) / Math.max(1, record.length);
          return [row.name, { frames: record.length, mean: +mean.toFixed(2), max: +Math.max(...record).toFixed(2), still: record.filter((move) => move < 0.01).length }];
        }),
      ),
  };

  useHudMessages((message) => {
    if (message.type === 'fixedStep/rate') setStepsPerSecond(Number(message.stepsPerSecond));
    if (message.type === 'fixedStep/speed') setSpeed(Number(message.speed));
  });
  useHudState('fixedStep/state', () => ({ stepsPerSecond, speed, fps: Math.round(fps.current), steps: running.current?.steps ?? 0 }));

  return (
    <>
      <LabStage />
      {ROWS.map((row, i) => (
        <staticMeshActor
          key={row.name}
          ref={(actor) => {
            cubes.current[i] = actor;
          }}
          location={[0, row.y, 100]}
          staticMeshComponent={{ mobility: UE.EComponentMobility.Movable, staticMesh: CUBE, overrideMaterials: [colored([...row.color])] }}
        />
      ))}
    </>
  );
}
