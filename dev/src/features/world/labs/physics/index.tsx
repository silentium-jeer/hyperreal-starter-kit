import { LabStage } from '../../../../scenes/lab-stage/LabStage';
import { BoxPyramid } from '../../entities/BoxPyramid';
import { Dominoes } from '../../entities/Dominoes';
import { SphereRain } from '../../entities/SphereRain';

export function Scene() {
  return (
    <>
      <LabStage groundSize={20} camera={{ location: [-1100, -700, 650], rotation: [-22, 30, 0] }} />
      <Dominoes at={[-500, -300, 0]} />
      <BoxPyramid at={[300, 300, 0]} rows={6} />
      <SphereRain at={[0, 0, 0]} />
    </>
  );
}
