import flightCase from '../../assets/flight-case.glb';
import { LabStage } from '../../../../scenes/lab-stage/LabStage';
import { useContentMesh } from '../../../../shared/react';

const SIDE = 100;
const PITCH = 160;
const PLACEHOLDER = '/Engine/BasicShapes/Cube.Cube';

// 10,000 copies of the Nanite mesh imported from ../../assets/flight-case.glb: 10,000 elements, one instanced
// component, drawn by Nanite at a triangle count the screen asks for rather than the one the mesh has.
function Field() {
  const mesh = useContentMesh(flightCase);
  return (
    <>
      {Array.from({ length: SIDE * SIDE }, (_, i) => {
        const [x, y] = [i % SIDE, Math.floor(i / SIDE)];
        return <staticMeshComponent key={i} location={[(x - SIDE / 2) * PITCH, (y - SIDE / 2) * PITCH, 45]} rotation={[0, (i * 37) % 360, 0]} staticMesh={mesh ?? PLACEHOLDER} />;
      })}
    </>
  );
}

export function Scene() {
  return (
    <>
      <LabStage groundSize={170} camera={{ location: [-9500, -9500, 3200], rotation: [-14, 45, 0] }} />
      <Field />
    </>
  );
}
