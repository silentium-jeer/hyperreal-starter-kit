import flightCase from '../../assets/flight-case.glb';
import { useState } from 'react';
import { LabStage } from '../../../../scenes/lab-stage/LabStage';
import { useContentAsset, useContentMesh, useHudMessages, useHudState } from '../../../../shared/react';
import { LiveAsset } from '../../entities/LiveAsset';

export function Scene() {
  const [turn, setTurn] = useState(20);
  const asset = useContentAsset(flightCase);
  const mesh = useContentMesh(flightCase);

  useHudMessages((message) => {
    if (message.type === 'flightCase/turn') setTurn(Number(message.degreesPerSecond));
  });
  useHudState('flightCase/state', () => ({
    turn,
    build: asset?.build ?? null,
    mesh: mesh ? mesh.GetName() : '',
    ready: Boolean(mesh),
  }));

  return (
    <>
      <LabStage groundSize={10} camera={{ location: [-260, 0, 140], rotation: [-15, 0, 0] }} />
      <LiveAsset asset={flightCase} at={[0, 0, 45]} turnDegreesPerSecond={turn} />
    </>
  );
}
