import { LabStage } from '../../../../scenes/lab-stage/LabStage';
import { BoxPyramid, Stairs } from '../../../world';
import { Player } from '../../entities/Player';

export function Scene() {
  return (
    <>
      <LabStage groundSize={30} camera={null} />
      <Player at={[-200, 0, 100]} />
      {/* Stairs to the character's right, climbing along +X. */}
      <Stairs at={[-150, 350, 0]} steps={12} />
      <BoxPyramid at={[300, 0, 0]} />
    </>
  );
}
