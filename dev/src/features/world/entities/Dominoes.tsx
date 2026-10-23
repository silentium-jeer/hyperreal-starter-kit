import * as UE from 'ue';
import { useEffect, useRef } from 'react';
import { colored } from '../../../shared/engine/world';
import type { Vector3 } from '../../../shared/react/props';

// A line of simulated dominoes along +X from `at`; the first one is pushed `pushAfterMs` after the row appears.
export interface DominoesProps {
  at: Vector3;
  count?: number;
  spacing?: number;
  pushAfterMs?: number;
}

const CUBE = '/Engine/BasicShapes/Cube.Cube';
const SIZE: Vector3 = [8, 50, 100];

export function Dominoes({ at, count = 24, spacing = 55, pushAfterMs = 1500 }: DominoesProps) {
  const first = useRef<UE.StaticMeshComponent>(null);
  useEffect(() => {
    const timer = setTimeout(() => first.current?.AddImpulse(new UE.Vector(4000, 0, 0), 'None', false), pushAfterMs);
    return () => clearTimeout(timer);
  }, [pushAfterMs]);
  const material = colored([0.92, 0.9, 0.86]);
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <staticMeshComponent
          key={i}
          ref={i === 0 ? first : undefined}
          location={[at[0] + i * spacing, at[1], at[2] + SIZE[2] / 2]}
          scale={[SIZE[0] / 100, SIZE[1] / 100, SIZE[2] / 100]}
          staticMesh={CUBE}
          overrideMaterials={[material]}
          mobility={UE.EComponentMobility.Movable}
          simulatePhysics
        />
      ))}
    </>
  );
}
