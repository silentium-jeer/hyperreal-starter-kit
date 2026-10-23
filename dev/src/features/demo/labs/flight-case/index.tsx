import flightCase from '../../assets/flight-case.glb';
import { LabStage } from '../../../../scenes/lab-stage/LabStage';
import { LiveAsset } from '../../entities/LiveAsset';

export function Scene() {
  return (
    <>
      <LabStage groundSize={10} camera={{ location: [-260, 0, 140], rotation: [-15, 0, 0] }} />
      <LiveAsset asset={flightCase} at={[0, 0, 45]} />
    </>
  );
}
