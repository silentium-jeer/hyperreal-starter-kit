import * as UE from 'ue';
import type { ModularCharacterLook } from './modularCharacter';

const ROOT = '/Game/Characters/Mannequins';
export const MANNEQUIN_MESHES = {
  manny: `${ROOT}/Meshes/SKM_Manny_Simple.SKM_Manny_Simple`,
  quinn: `${ROOT}/Meshes/SKM_Quinn_Simple.SKM_Quinn_Simple`,
};
export type MannequinVariant = keyof typeof MANNEQUIN_MESHES;

const CLIPS: Record<string, string> = {
  idle: 'MM_Idle',
  walking: 'Walk/MF_Unarmed_Walk_Fwd',
  running: 'Jog/MF_Unarmed_Jog_Fwd',
  jump_start: 'Jump/MM_Jump',
  jump_loop: 'Jump/MM_Fall_Loop',
  jump_land: 'Jump/MM_Land',
};

export function mannequinClips() {
  const clips = new Map<string, UE.AnimSequence>();
  for (const [clip, file] of Object.entries(CLIPS)) {
    const name = file.slice(file.lastIndexOf('/') + 1);
    const animation = UE.Object.Load(`${ROOT}/Anims/Unarmed/${file}.${name}`) as UE.AnimSequence | undefined;
    if (animation) clips.set(clip, animation);
    else console.error(`[mannequin] missing clip ${clip} (${file})`);
  }
  return clips;
}

export function clipPlayer(leader: UE.SkeletalMeshComponent, clips: Map<string, UE.AnimSequence>, initialClip = 'idle'): ModularCharacterLook {
  let current = { clip: initialClip, loop: true };
  const play = (clip: string, loop = true) => {
    current = { clip, loop };
    const animation = clips.get(clip);
    if (!animation) return false;
    leader.PlayAnimation(animation, loop);
    return true;
  };
  play(initialClip);
  return { play, playing: () => current.clip, finished: () => !current.loop && !leader.IsPlaying(), clips: () => [...clips.keys()] };
}
