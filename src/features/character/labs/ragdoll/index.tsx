import * as UE from 'ue';
import { $ref } from 'puerts';
import { useEffect, useRef, useState } from 'react';
import { LabStage } from '../../../../scenes/lab-stage/LabStage';
import { useFrame, useHudMessages, useHudState } from '../../../../shared/react';
import { MIXAMO_CLIPS, mixamo } from '../../assets/mixamo';
import { ImportedCharacter } from '../../entities/ImportedCharacter';

const ignoredHit = $ref(new UE.HitResult());
const DROP_HEIGHT = 200;

interface Episode {
  frames: number;
  minHeadToHips: number;
  restHeadToHips: number;
  maxSpeed: number;
  lastSpeed: number;
}

export function Scene() {
  const component = useRef<UE.SkeletalMeshComponent | null>(null);
  const [drops, setDrops] = useState(0);
  const episode = useRef<Episode | null>(null);

  useHudMessages((message) => {
    if (message.type === 'ragdoll/drop') setDrops((n) => n + 1);
  });

  useEffect(() => {
    const mesh = component.current;
    if (!mesh || !drops) return;
    mesh.SetSimulatePhysics(false);
    mesh.K2_SetWorldLocationAndRotation(new UE.Vector(0, 0, DROP_HEIGHT), new UE.Rotator(0, 0, 0), false, ignoredHit, true);
    mesh.SetCollisionProfileName('Ragdoll', true);
    mesh.SetSimulatePhysics(true);
    mesh.AddImpulse(new UE.Vector(0, 250, 120), 'None', true);
    const rest = UE.Vector.Dist(mesh.GetSocketLocation('Head'), mesh.GetSocketLocation('Hips'));
    episode.current = { frames: 0, minHeadToHips: rest, restHeadToHips: rest, maxSpeed: 0, lastSpeed: 0 };
  }, [drops]);

  useFrame(() => {
    const mesh = component.current;
    const now = episode.current;
    if (!mesh || !now) return;
    now.frames++;
    now.minHeadToHips = Math.min(now.minHeadToHips, UE.Vector.Dist(mesh.GetSocketLocation('Head'), mesh.GetSocketLocation('Hips')));
    let speed = 0;
    for (const bone of ['Hips', 'Head', 'LeftHand', 'RightFoot']) speed = Math.max(speed, mesh.GetPhysicsLinearVelocity(bone).Size());
    now.lastSpeed = speed;
    now.maxSpeed = Math.max(now.maxSpeed, speed);
  });

  const bodies = () => component.current?.SkeletalMesh?.PhysicsAsset?.SkeletalBodySetups.Num() ?? 0;
  (globalThis as any).ragdollLab = {
    report: () => {
      const mesh = component.current;
      const now = episode.current;
      if (!mesh || !now) return { bodies: bodies(), dropped: false };
      const hips = mesh.GetSocketLocation('Hips');
      return {
        bodies: bodies(),
        frames: now.frames,
        restHeadToHips: +now.restHeadToHips.toFixed(1),
        minHeadToHips: +now.minHeadToHips.toFixed(1),
        maxSpeed: +now.maxSpeed.toFixed(0),
        lastSpeed: +now.lastSpeed.toFixed(1),
        hipsHeight: +hips.Z.toFixed(1),
      };
    },
  };

  useHudState('ragdoll/state', () => ({ drops, bodies: bodies(), ...(globalThis as any).ragdollLab.report() }));

  return (
    <>
      <LabStage groundSize={12} camera={{ location: [-520, 0, 220], rotation: [-14, 0, 0], focus: [0, 0, 60] }} />
      <ImportedCharacter model={mixamo} clip={MIXAMO_CLIPS.idle.clip} onReady={(playing) => (component.current = playing)} />
    </>
  );
}
