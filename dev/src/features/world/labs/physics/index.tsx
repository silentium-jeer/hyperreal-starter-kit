import * as UE from 'ue';
import { $ref, $unref } from 'puerts';
import { useState } from 'react';
import { LabStage } from '../../../../scenes/lab-stage/LabStage';
import { world } from '../../../../shared/engine/world';
import { useHudMessages, useHudState } from '../../../../shared/react';
import { BoxPyramid } from '../../entities/BoxPyramid';
import { Dominoes } from '../../entities/Dominoes';
import { SphereRain } from '../../entities/SphereRain';

// The rigid bodies Chaos simulates in this world, and how many of them are awake (moving) right now.
function bodies() {
  const actors = $ref(UE.NewArray(UE.Actor));
  UE.GameplayStatics.GetAllActorsOfClass(world, UE.Actor.StaticClass(), actors);
  const list = $unref(actors);
  let simulating = 0;
  let awake = 0;
  for (let i = 0; i < list.Num(); i++) {
    const components = list.Get(i).K2_GetComponentsByClass(UE.StaticMeshComponent.StaticClass());
    for (let j = 0; j < components.Num(); j++) {
      const component = components.Get(j) as UE.StaticMeshComponent;
      if (!component.IsSimulatingPhysics('None')) continue;
      simulating += 1;
      if (component.IsAnyRigidBodyAwake()) awake += 1;
    }
  }
  return { simulating, awake };
}

// Chaos rigid bodies declared in React: a row of dominoes pushed once, a box pyramid, spheres added and removed as a
// list. Its HUD (dev/ui/hud/PhysicsLabHud.tsx) sets the dominoes up again, rebuilds the pyramid at a size, and turns
// the sphere rain on and off at a rate, with the number of bodies simulated and awake.
export function Scene() {
  const [dominoRound, setDominoRound] = useState(0);
  const [rows, setRows] = useState(6);
  const [pyramidRound, setPyramidRound] = useState(0);
  const [raining, setRaining] = useState(true);
  const [everyMs, setEveryMs] = useState(700);

  useHudMessages((message) => {
    if (message.type === 'physics/dominoes') setDominoRound((value) => value + 1);
    if (message.type === 'physics/pyramid') {
      setRows(Number(message.rows));
      setPyramidRound((value) => value + 1);
    }
    if (message.type === 'physics/rain') setRaining(Boolean(message.on));
    if (message.type === 'physics/rainEvery') setEveryMs(Number(message.everyMs));
  });
  useHudState('physics/state', () => ({ rows, raining, everyMs, ...bodies() }));

  return (
    <>
      <LabStage groundSize={20} camera={{ location: [-1100, -700, 650], rotation: [-22, 30, 0] }} />
      <Dominoes key={`dominoes-${dominoRound}`} at={[-500, -300, 0]} />
      <BoxPyramid key={`pyramid-${pyramidRound}`} at={[300, 300, 0]} rows={rows} />
      {raining && <SphereRain at={[0, 0, 0]} everyMs={everyMs} />}
    </>
  );
}
