import { colored } from '../../../shared/engine/world';
import type { Vector3 } from '../../../shared/react/props';

// A ring of columns with a lintel on each pair: dozens of elements, two packed instanced groups (one per mesh
// and material), however many rings a scene has.
export interface ColonnadeProps {
  at: Vector3;
  radius?: number;
  columns?: number;
  height?: number;
}

const CYLINDER = '/Engine/BasicShapes/Cylinder.Cylinder';
const CUBE = '/Engine/BasicShapes/Cube.Cube';
const STONE: Vector3 = [0.62, 0.58, 0.52];

export function Colonnade({ at, radius = 600, columns = 16, height = 400 }: ColonnadeProps) {
  const stone = colored(STONE);
  const step = (2 * Math.PI) / columns;
  return (
    <>
      {Array.from({ length: columns }, (_, i) => {
        const angle = i * step;
        const [x, y] = [at[0] + Math.cos(angle) * radius, at[1] + Math.sin(angle) * radius];
        return <staticMeshComponent key={`column-${i}`} location={[x, y, at[2] + height / 2]} scale={[0.5, 0.5, height / 100]} staticMesh={CYLINDER} overrideMaterials={[stone]} />;
      })}
      {Array.from({ length: columns / 2 }, (_, i) => {
        const angle = (2 * i + 0.5) * step;
        const yaw = (angle * 180) / Math.PI + 90;
        const span = (2 * Math.sin(step / 2) * radius) / 100 + 0.6;
        return (
          <staticMeshComponent
            key={`lintel-${i}`}
            location={[at[0] + Math.cos(angle) * radius * Math.cos(step / 2), at[1] + Math.sin(angle) * radius * Math.cos(step / 2), at[2] + height + 20]}
            rotation={[0, yaw, 0]}
            scale={[span, 0.6, 0.4]}
            staticMesh={CUBE}
            overrideMaterials={[stone]}
          />
        );
      })}
    </>
  );
}
