import * as UE from 'ue';
import { assetName, loadContent, onAsset, type ContentAssetRef } from '../../../shared/engine/content';
import { spawn } from '../../../shared/engine/world';

// A character from a content asset that holds one or more skeletal meshes on one skeleton (body, head,
// outfit pieces): the first mesh leads the pose, the others follow it (SetLeaderPoseComponent), the way
// Unreal assembles modular characters. Rebuilt in place every time the source file is built again.
export interface ModularCharacterLook {
  play(clip: string, loop?: boolean): boolean;
  playing(): string;
  // True once a clip played without looping has reached its end.
  finished(): boolean;
  clips(): string[];
}

export interface ModularCharacter extends ModularCharacterLook {
  actor: UE.SkeletalMeshActor;
}

// Clips embedded in the character file are named "<file><clip>" by Interchange (student.glb clip "Idle" ->
// "StudentIdle"); keep the clip part.
function clipName(path: string, fileName: string) {
  const objectName = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
  const prefix = fileName.toLowerCase();
  return objectName.startsWith(prefix) ? objectName.slice(prefix.length) : objectName;
}

// Dresses `leader` (a skeletal mesh component of `owner`) with an imported model file.
export function attachModularCharacter(owner: UE.Actor, leader: UE.SkeletalMeshComponent, model: ContentAssetRef, initialClip = 'idle'): ModularCharacterLook {
  const name = assetName(model);
  let followers: UE.SkeletalMeshComponent[] = [];
  let clips = new Map<string, UE.AnimSequence>();
  let current = { clip: initialClip, loop: true };

  const play = (clip: string, loop = true) => {
    const animation = clips.get(clip);
    current = { clip, loop };
    if (!animation) return false;
    leader.PlayAnimation(animation, loop);
    return true;
  };

  onAsset(model, (asset) => {
    for (const follower of followers) follower.K2_DestroyComponent(follower);
    followers = [];

    const meshes = asset.skeletalMeshes.map((path) => loadContent<UE.SkeletalMesh>(path)).filter((mesh): mesh is UE.SkeletalMesh => Boolean(mesh));
    if (meshes.length === 0) return;
    leader.SetSkeletalMeshAsset(meshes[0]);
    for (const mesh of meshes.slice(1)) {
      const follower = UE.NewObject(UE.SkeletalMeshComponent.StaticClass(), owner) as UE.SkeletalMeshComponent;
      follower.RegisterComponent();
      follower.K2_AttachToComponent(leader, 'None', UE.EAttachmentRule.SnapToTarget, UE.EAttachmentRule.SnapToTarget, UE.EAttachmentRule.SnapToTarget, false);
      follower.SetSkeletalMeshAsset(mesh);
      follower.SetLeaderPoseComponent(leader, true);
      followers.push(follower);
    }

    clips = new Map(
      asset.animations
        .map((path) => [clipName(path, name), loadContent<UE.AnimSequence>(path)] as const)
        .filter((entry): entry is readonly [string, UE.AnimSequence] => Boolean(entry[1])),
    );
    play(current.clip, current.loop);
    console.log(`[character] ${model.key} build ${asset.build}: ${meshes.length} meshes, clips ${[...clips.keys()].join(', ')}`);
  });

  return { play, playing: () => current.clip, finished: () => !current.loop && !leader.IsPlaying(), clips: () => [...clips.keys()] };
}

export function mountModularCharacter(model: ContentAssetRef, location: UE.Vector, rotation = new UE.Rotator(0, 0, 0), initialClip = 'idle'): ModularCharacter {
  const actor = spawn<UE.SkeletalMeshActor>(UE.SkeletalMeshActor, location, rotation, undefined, (a) => {
    a.SkeletalMeshComponent.SetMobility(UE.EComponentMobility.Movable);
  });
  return { actor, ...attachModularCharacter(actor, actor.SkeletalMeshComponent, model, initialClip) };
}
