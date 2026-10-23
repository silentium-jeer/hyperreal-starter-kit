import * as UE from 'ue';
import { useEffect, useRef } from 'react';
import { LabStage } from '../../../../scenes/lab-stage/LabStage';
import { MANNEQUIN_MESHES, clipPlayer, mannequinClips } from '../../entities/mannequin';

const CLIP_SECONDS = 3;

// The stock Mannequin cycling through the template's unarmed clips, played by name from TS, no Animation Blueprint.
function ClipCycle() {
  const actor = useRef<UE.SkeletalMeshActor>(null);
  useEffect(() => {
    const component = actor.current!.SkeletalMeshComponent;
    const clips = mannequinClips();
    const look = clipPlayer(component, clips);
    const names = look.clips();
    let index = 0;
    const timer = setInterval(() => {
      index = (index + 1) % names.length;
      look.play(names[index]);
      console.log(`[mannequin-lab] playing ${names[index]}`);
    }, CLIP_SECONDS * 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <skeletalMeshActor
      ref={actor}
      rotation={[0, 90, 0]}
      skeletalMeshComponent={{ mobility: UE.EComponentMobility.Movable, skeletalMeshAsset: MANNEQUIN_MESHES.manny }}
    />
  );
}

export function Scene() {
  return (
    <>
      <LabStage groundSize={10} camera={{ location: [-320, 0, 130], rotation: [-8, 0, 0] }} />
      <ClipCycle />
    </>
  );
}
