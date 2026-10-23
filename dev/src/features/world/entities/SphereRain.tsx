import * as UE from 'ue';
import { useEffect, useState } from 'react';
import { colored } from '../../../shared/engine/world';
import type { Vector3 } from '../../../shared/react/props';

// Simulated spheres dropped over an area every `everyMs`; past `max` the oldest one is removed. The scene is the
// list of drops: React adds a physics body for each new entry and destroys the one that leaves the list.
export interface SphereRainProps {
  at: Vector3;
  area?: number;
  everyMs?: number;
  max?: number;
}

const SPHERE = '/Engine/BasicShapes/Sphere.Sphere';
const PALETTE: Vector3[] = [
  [0.95, 0.35, 0.2],
  [0.2, 0.6, 0.95],
  [0.95, 0.8, 0.2],
  [0.4, 0.85, 0.45],
];

interface Drop {
  id: number;
  location: Vector3;
  color: Vector3;
}

export function SphereRain({ at, area = 400, everyMs = 700, max = 30 }: SphereRainProps) {
  const [drops, setDrops] = useState<Drop[]>([]);
  useEffect(() => {
    let id = 0;
    const timer = setInterval(() => {
      id += 1;
      const location: Vector3 = [at[0] + (Math.random() - 0.5) * area, at[1] + (Math.random() - 0.5) * area, at[2] + 700];
      setDrops((current) => [...current, { id, location, color: PALETTE[id % PALETTE.length] }].slice(-max));
    }, everyMs);
    return () => clearInterval(timer);
  }, [at[0], at[1], at[2], area, everyMs, max]);
  return (
    <>
      {drops.map((drop) => (
        <staticMeshComponent
          key={drop.id}
          location={drop.location}
          scale={0.5}
          staticMesh={SPHERE}
          overrideMaterials={[colored(drop.color)]}
          mobility={UE.EComponentMobility.Movable}
          simulatePhysics
        />
      ))}
    </>
  );
}
