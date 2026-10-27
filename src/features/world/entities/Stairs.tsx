import { colored } from '../../../shared/engine/world';
import type { Vector3 } from '../../../shared/react/props';

export interface StairsProps {
  at: Vector3;
  steps?: number;
  stepHeight?: number;
  stepDepth?: number;
  width?: number;
  color?: Vector3;
}

const CUBE = '/Engine/BasicShapes/Cube.Cube';

export function Stairs({ at, steps = 10, stepHeight = 20, stepDepth = 35, width = 200, color = [0.55, 0.5, 0.45] }: StairsProps) {
  const material = colored(color);
  return (
    <>
      {Array.from({ length: steps }, (_, i) => {
        const height = stepHeight * (i + 1);
        return (
          <staticMeshComponent
            key={i}
            location={[at[0] + stepDepth * (i + 0.5), at[1], at[2] + height / 2]}
            scale={[stepDepth / 100, width / 100, height / 100]}
            staticMesh={CUBE}
            overrideMaterials={[material]}
          />
        );
      })}
    </>
  );
}
