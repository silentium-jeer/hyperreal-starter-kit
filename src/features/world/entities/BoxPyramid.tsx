import * as UE from 'ue';
import { colored } from '../../../shared/engine/world';
import type { Vector3 } from '../../../shared/react/props';

export interface BoxPyramidProps {
  at: Vector3;
  rows?: number;
  size?: number;
}

const CUBE = '/Engine/BasicShapes/Cube.Cube';

export function BoxPyramid({ at, rows = 4, size = 60 }: BoxPyramidProps) {
  const scale = size / 100;
  const pitch = size + 10;
  return (
    <>
      {Array.from({ length: rows }, (_, row) =>
        Array.from({ length: rows - row }, (_, column) => (
          <staticMeshComponent
            key={`${row}-${column}`}
            location={[at[0], at[1] + (column - (rows - 1 - row) / 2) * pitch, at[2] + size / 2 + row * (size + 2)]}
            scale={scale}
            staticMesh={CUBE}
            overrideMaterials={[colored([0.2 + (0.6 * row) / rows, 0.45, 0.85 - (0.45 * row) / rows])]}
            mobility={UE.EComponentMobility.Movable}
            simulatePhysics
          />
        )),
      )}
    </>
  );
}
