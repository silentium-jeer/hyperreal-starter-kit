import * as UE from 'ue';
import { useRef, useState } from 'react';
import { LabStage } from '../../../../scenes/lab-stage/LabStage';
import { NiagaraSystem, useHudMessages, useHudState } from '../../../../shared/react';
import { sandstorm } from '../../assets/sandstorm.niagara';

const RESOLUTIONS = [96, 128, 192, 256];

export function Scene() {
  const storm = useRef<UE.NiagaraActor | null>(null);
  const [resolution, setResolution] = useState(192);

  useHudMessages((message) => {
    const component = storm.current?.NiagaraComponent;
    if (message.type === 'sandstorm/resolution' && component) {
      const cells = Number(message.cells);
      component.SetVariableInt('ResolutionMaxAxis', cells);
      component.ReinitializeSystem();
      setResolution(cells);
    }
    if (message.type === 'sandstorm/restart') component?.ReinitializeSystem();
  });
  useHudState('sandstorm/state', () => ({ resolution, resolutions: RESOLUTIONS }));

  return (
    <>
      <LabStage sunPitch={-22} sunYaw={20} groundSize={80} camera={{ location: [-1200, -2400, 380], rotation: [-6, 62, 0] }} />
      <NiagaraSystem system={sandstorm} at={[0, 0, 0]} actorRef={storm} />
    </>
  );
}
