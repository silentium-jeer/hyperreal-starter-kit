import { LabStage } from '../../../../scenes/lab-stage/LabStage';
import { colored } from '../../../../shared/engine/world';
import type { Vector3 } from '../../../../shared/react/props';

const CUBE = '/Engine/BasicShapes/Cube.Cube';
const SIDE = 40;
const PITCH = 60;
const BANDS: Vector3[] = [
  [0.25, 0.45, 0.85],
  [0.3, 0.7, 0.55],
  [0.9, 0.7, 0.25],
  [0.85, 0.35, 0.3],
];

// 1600 cubes as 1600 ordinary elements; the renderer packs them into one instanced component per material.
function CityBlock() {
  const materials = BANDS.map((color) => colored(color));
  return (
    <>
      {Array.from({ length: SIDE * SIDE }, (_, i) => {
        const [x, y] = [i % SIDE, Math.floor(i / SIDE)];
        const distance = Math.hypot(x - SIDE / 2, y - SIDE / 2);
        const height = 20 + 260 * Math.max(0, Math.cos(distance / 6)) * (1 - distance / SIDE);
        return (
          <staticMeshComponent
            key={i}
            location={[(x - SIDE / 2) * PITCH, (y - SIDE / 2) * PITCH, height / 2]}
            scale={[0.5, 0.5, height / 100]}
            staticMesh={CUBE}
            overrideMaterials={[materials[Math.min(BANDS.length - 1, Math.floor(height / 75))]]}
          />
        );
      })}
    </>
  );
}

export function Scene() {
  return (
    <>
      <LabStage groundSize={30} camera={{ location: [-2200, -1700, 1500], rotation: [-28, 38, 0] }} />
      <CityBlock />
    </>
  );
}
