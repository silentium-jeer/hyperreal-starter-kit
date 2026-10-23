import { colored } from '../../../shared/engine/world';
import type { Vector3 } from '../../../shared/react/props';

// A straight flight of box steps along +X, starting at `at` (the foot of the first step). Step height stays
// under CharacterMovement's default MaxStepHeight (45 cm) so characters walk up it. Every step is the same
// mesh and material, so a flight is instances of one packed group, however many flights a scene has.
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
        // The basic cube is 100 cm with its pivot at the centre: each step is a column from the ground up.
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
