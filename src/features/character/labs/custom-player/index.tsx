import * as UE from 'ue';
import { useMemo, useState } from 'react';
import { LabStage } from '../../../../scenes/lab-stage/LabStage';
import { world } from '../../../../shared/engine/world';
import { useContentAsset, useHudMessages, useHudState } from '../../../../shared/react';
import { BoxPyramid, Stairs } from '../../../world';
import { mixamo, mixamoWithMannyClips } from '../../assets/mixamo';
import { useSkeletalMesh } from '../../entities/ImportedCharacter';
import { locomotionClipsIn } from '../../entities/MannequinLocomotion';
import { Player, type PlayerLook } from '../../entities/Player';

export function Scene() {
  const [body, setBody] = useState<'mixamo' | 'manny'>('mixamo');
  const mesh = useSkeletalMesh(mixamo, undefined);
  const retargeted = useContentAsset(mixamoWithMannyClips);
  const look = useMemo<PlayerLook | undefined>(() => {
    const clips = retargeted && locomotionClipsIn(retargeted.objects);
    return mesh && clips ? { mesh, clips } : undefined;
  }, [mesh, retargeted]);

  useHudMessages((message) => {
    if (message.type === 'customPlayer/body') setBody(message.body === 'manny' ? 'manny' : 'mixamo');
  });
  useHudState('customPlayer/state', () => {
    const pawn = UE.GameplayStatics.GetPlayerPawn(world, 0) as UE.Character | undefined;
    const velocity = pawn?.CharacterMovement?.Velocity;
    return {
      body,
      ready: Boolean(look),
      mesh: body === 'mixamo' ? look?.mesh instanceof UE.Object ? UE.KismetSystemLibrary.GetPathName(look.mesh) : '' : 'SKM_Manny_Simple',
      clips: body === 'mixamo' ? look?.clips ?? null : null,
      retargeted: retargeted?.objects.length ?? 0,
      speed: velocity ? Math.round(Math.hypot(velocity.X, velocity.Y)) : 0,
    };
  });

  const playing = body === 'mixamo' ? look : undefined;
  return (
    <>
      <LabStage groundSize={30} camera={null} />
      {(body === 'manny' || look) && <Player key={body} at={[-200, 0, 100]} look={playing} />}
      <Stairs at={[-150, 350, 0]} steps={12} />
      <BoxPyramid at={[300, 0, 0]} />
    </>
  );
}
