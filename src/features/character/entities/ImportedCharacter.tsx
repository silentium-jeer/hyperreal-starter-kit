import * as UE from 'ue';
import { useEffect, useRef, useState } from 'react';
import { loadContent, type ContentAssetRef } from '../../../shared/engine/content';
import { useContentAsset } from '../../../shared/react';
import type { Vector3 } from '../../../shared/react/props';

export interface ImportedCharacterProps {
  model?: ContentAssetRef;
  mesh?: string;
  clip?: ContentAssetRef;
  animation?: string;
  location?: Vector3;
  rotation?: Vector3;
  onReady?: (component: UE.SkeletalMeshComponent) => void;
}

export function useSkeletalMesh(model: ContentAssetRef | undefined, mesh: string | undefined) {
  const asset = useContentAsset(model);
  const [loaded, setLoaded] = useState<UE.SkeletalMesh>();
  useEffect(() => {
    const path = mesh ?? asset?.skeletalMeshes[0];
    if (path) setLoaded(loadContent<UE.SkeletalMesh>(path));
  }, [asset, mesh]);
  return loaded;
}

export function useAnimation(clip: ContentAssetRef | undefined, path: string | undefined) {
  const asset = useContentAsset(clip);
  const [loaded, setLoaded] = useState<UE.AnimSequence>();
  useEffect(() => {
    const found = path ?? asset?.animations[0];
    if (found) setLoaded(loadContent<UE.AnimSequence>(found));
  }, [asset, path]);
  return loaded;
}

export function ImportedCharacter({ model, mesh, clip, animation, location = [0, 0, 0], rotation = [0, 0, 0], onReady }: ImportedCharacterProps) {
  const actor = useRef<UE.SkeletalMeshActor>(null);
  const skeletalMesh = useSkeletalMesh(model, mesh);
  const sequence = useAnimation(clip, animation);
  useEffect(() => {
    const component = actor.current?.SkeletalMeshComponent;
    if (!component || !sequence) return;
    component.PlayAnimation(sequence, true);
    onReady?.(component);
  }, [skeletalMesh, sequence]);
  if (!skeletalMesh) return null;
  return <skeletalMeshActor ref={actor} location={location} rotation={rotation} skeletalMeshComponent={{ mobility: UE.EComponentMobility.Movable, skeletalMeshAsset: skeletalMesh }} />;
}
