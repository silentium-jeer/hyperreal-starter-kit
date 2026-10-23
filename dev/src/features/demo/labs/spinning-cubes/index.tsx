import { LabStage } from '../../../../scenes/lab-stage/LabStage';
import { SpinningCubes } from '../../entities/SpinningCubes';

export function Scene() {
  return (
    <>
      <LabStage />
      <SpinningCubes at={[0, 0, 100]} />
    </>
  );
}
