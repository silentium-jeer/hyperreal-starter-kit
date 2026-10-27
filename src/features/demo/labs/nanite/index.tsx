import * as UE from 'ue';
import flightCase from '../../assets/flight-case.glb';
import { useEffect, useState } from 'react';
import { LabStage } from '../../../../scenes/lab-stage/LabStage';
import { world } from '../../../../shared/engine/world';
import { useContentMesh, useHudMessages, useHudState, useSmoothedFps } from '../../../../shared/react';

const PITCH = 160;
const PLACEHOLDER = '/Engine/BasicShapes/Cube.Cube';
const VIEWS = ['off', 'triangles', 'clusters', 'overview'];

function Field({ side }: { side: number }) {
  const mesh = useContentMesh(flightCase);
  return (
    <>
      {Array.from({ length: side * side }, (_, i) => {
        const [x, y] = [i % side, Math.floor(i / side)];
        return <staticMeshComponent key={i} location={[(x - side / 2) * PITCH, (y - side / 2) * PITCH, 45]} rotation={[0, (i * 37) % 360, 0]} staticMesh={mesh ?? PLACEHOLDER} />;
      })}
    </>
  );
}

export function Scene() {
  const [side, setSide] = useState(100);
  const [view, setView] = useState('off');
  const fps = useSmoothedFps();

  useEffect(() => {
    const controller = UE.GameplayStatics.GetPlayerController(world, 0);
    UE.KismetSystemLibrary.ExecuteConsoleCommand(world, `r.Nanite.Visualize ${view === 'off' ? 'None' : view}`, controller);
  }, [view]);
  useEffect(
    () => () => UE.KismetSystemLibrary.ExecuteConsoleCommand(world, 'r.Nanite.Visualize None', UE.GameplayStatics.GetPlayerController(world, 0)),
    [],
  );
  useHudMessages((message) => {
    if (message.type === 'nanite/side') setSide(Number(message.side));
    if (message.type === 'nanite/view' && VIEWS.includes(String(message.view))) setView(String(message.view));
  });
  useHudState('nanite/state', () => ({ side, copies: side * side, view, fps: Math.round(fps.current) }));

  return (
    <>
      <LabStage groundSize={170} camera={{ location: [-9500, -9500, 3200], rotation: [-14, 45, 0] }} />
      <Field side={side} />
    </>
  );
}
