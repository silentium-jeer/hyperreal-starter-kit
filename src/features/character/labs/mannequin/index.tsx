import * as UE from 'ue';
import { useEffect, useRef, useState } from 'react';
import { LabStage } from '../../../../scenes/lab-stage/LabStage';
import { useEvery, useHudMessages, useHudState } from '../../../../shared/react';
import { MANNEQUIN_MESHES, clipPlayer, mannequinClips } from '../../entities/mannequin';

const CLIP_SECONDS = 3;

function ClipCycle() {
  const actor = useRef<UE.SkeletalMeshActor>(null);
  const player = useRef<ReturnType<typeof clipPlayer>>(null);
  const clips = useRef<Map<string, UE.AnimSequence>>(new Map());
  const [cycling, setCycling] = useState(true);
  const [clip, setClip] = useState('idle');

  useEffect(() => {
    clips.current = mannequinClips();
    player.current = clipPlayer(actor.current!.SkeletalMeshComponent, clips.current);
  }, []);
  useEffect(() => {
    player.current?.play(clip);
  }, [clip]);
  useEvery(cycling ? CLIP_SECONDS * 1000 : Infinity, () => {
    const names = [...clips.current.keys()];
    setClip((current) => names[(names.indexOf(current) + 1) % names.length]);
  });

  useHudMessages((message) => {
    if (message.type === 'mannequin/clip') {
      setCycling(false);
      setClip(String(message.clip));
    }
    if (message.type === 'mannequin/cycle') setCycling(Boolean(message.on));
  });
  useHudState('mannequin/state', () => {
    const component = actor.current?.SkeletalMeshComponent;
    return {
      clips: [...clips.current.keys()],
      clip,
      cycling,
      time: component ? component.GetPosition() : 0,
      length: clips.current.get(clip)?.GetPlayLength() ?? 0,
    };
  });

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
