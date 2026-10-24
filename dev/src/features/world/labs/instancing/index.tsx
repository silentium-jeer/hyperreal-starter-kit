import * as UE from 'ue';
import { useState } from 'react';
import { LabStage } from '../../../../scenes/lab-stage/LabStage';
import { colored, world } from '../../../../shared/engine/world';
import { useHudMessages, useHudState, useSmoothedFps } from '../../../../shared/react';
import type { Vector3 } from '../../../../shared/react/props';

const CUBE = '/Engine/BasicShapes/Cube.Cube';
const PITCH = 60;
const BANDS: Vector3[] = [
  [0.25, 0.45, 0.85],
  [0.3, 0.7, 0.55],
  [0.9, 0.7, 0.25],
  [0.85, 0.35, 0.3],
];

// side × side cubes as ordinary elements; the renderer packs them into one instanced component per material.
function CityBlock({ side }: { side: number }) {
  const materials = BANDS.map((color) => colored(color));
  return (
    <>
      {Array.from({ length: side * side }, (_, i) => {
        const [x, y] = [i % side, Math.floor(i / side)];
        const distance = Math.hypot(x - side / 2, y - side / 2);
        const height = 20 + 260 * Math.max(0, Math.cos(distance / 6)) * (1 - distance / side);
        return (
          <staticMeshComponent
            key={i}
            location={[(x - side / 2) * PITCH, (y - side / 2) * PITCH, height / 2]}
            scale={[0.5, 0.5, height / 100]}
            staticMesh={CUBE}
            overrideMaterials={[materials[Math.min(BANDS.length - 1, Math.floor(height / 75))]]}
          />
        );
      })}
    </>
  );
}

// The instanced components the renderer packed the elements into (UVgeInstancePool), with their instance counts.
function packed() {
  const pool = UE.SubsystemBlueprintLibrary.GetWorldSubsystem(world, UE.VgeInstancePool.StaticClass()) as UE.VgeInstancePool;
  const components = pool.Owner ? pool.Owner.K2_GetComponentsByClass(UE.InstancedStaticMeshComponent.StaticClass()) : undefined;
  const counts: number[] = [];
  for (let i = 0; i < (components?.Num() ?? 0); i++) {
    const instances = (components!.Get(i) as UE.InstancedStaticMeshComponent).GetInstanceCount();
    if (instances > 0) counts.push(instances);
  }
  return counts;
}

// Its HUD (dev/ui/hud/InstancingLabHud.tsx) sets the block's size and shows what the elements were packed into.
export function Scene() {
  const [side, setSide] = useState(40);
  const fps = useSmoothedFps();

  useHudMessages((message) => {
    if (message.type === 'instancing/side') setSide(Number(message.side));
  });
  useHudState('instancing/state', () => ({ side, elements: side * side, components: packed(), fps: Math.round(fps.current) }));

  return (
    <>
      <LabStage groundSize={30} camera={{ location: [-2200, -1700, 1500], rotation: [-28, 38, 0] }} />
      <CityBlock side={side} />
    </>
  );
}
