import { LabStage } from '../../../../scenes/lab-stage/LabStage';
import { surface, type Surface } from '../../../../shared/engine/world';
import type { Vector3 } from '../../../../shared/react/props';

const CUBE = '/Engine/BasicShapes/Cube.Cube';
const SPHERE = '/Engine/BasicShapes/Sphere.Sphere';

const WHITE: Surface = { color: [0.8, 0.8, 0.8], roughness: 0.6 };
const GLOSSY_FLOOR: Surface = { color: [0.75, 0.75, 0.75], roughness: 0.08 };
const RED: Surface = { color: [0.8, 0.06, 0.04], roughness: 0.7 };
const GREEN: Surface = { color: [0.05, 0.7, 0.1], roughness: 0.7 };
const CHROME: Surface = { color: [0.95, 0.95, 0.95], metallic: 1, roughness: 0.04 };
const GOLD: Surface = { color: [1, 0.72, 0.3], metallic: 1, roughness: 0.25 };
const LAMP: Surface = { color: [0, 0, 0], emissive: [1, 0.45, 0.15], emissiveStrength: 40 };

// A box `size` cm across centred at `at`, from the engine's 100 cm cube.
function Slab({ at, size, look, mesh = CUBE }: { at: Vector3; size: Vector3; look: Surface; mesh?: string }) {
  return <staticMeshComponent location={at} scale={[size[0] / 100, size[1] / 100, size[2] / 100]} staticMesh={mesh} overrideMaterials={[surface(look)]} />;
}

// A closed room lit only by the sun through a hole in the ceiling and by a glowing panel: everything else in the
// frame is light Lumen carried there, the red and green walls tinting the white ones, the floor and the metal
// reflecting the room.
export function Scene() {
  return (
    <>
      <LabStage ground={false} sunPitch={-68} sunYaw={20} camera={{ location: [-480, 0, 260], rotation: [-12, 0, 0] }} />
      <Slab at={[0, 0, -10]} size={[1240, 840, 20]} look={GLOSSY_FLOOR} />
      <Slab at={[-385, 0, 510]} size={[470, 840, 20]} look={WHITE} />
      <Slab at={[385, 0, 510]} size={[470, 840, 20]} look={WHITE} />
      <Slab at={[0, 285, 510]} size={[300, 270, 20]} look={WHITE} />
      <Slab at={[0, -285, 510]} size={[300, 270, 20]} look={WHITE} />
      <Slab at={[0, -410, 250]} size={[1240, 20, 520]} look={RED} />
      <Slab at={[0, 410, 250]} size={[1240, 20, 520]} look={GREEN} />
      <Slab at={[610, 0, 250]} size={[20, 840, 520]} look={WHITE} />
      <Slab at={[-610, 0, 250]} size={[20, 840, 520]} look={WHITE} />
      <Slab at={[595, 0, 260]} size={[10, 220, 120]} look={LAMP} />
      <Slab at={[200, -170, 80]} size={[160, 160, 160]} look={CHROME} mesh={SPHERE} />
      <Slab at={[260, 190, 60]} size={[120, 120, 120]} look={GOLD} />
      <Slab at={[0, 0, 40]} size={[80, 80, 80]} look={WHITE} />
    </>
  );
}
