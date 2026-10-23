import * as UE from 'ue';
import { useEffect, useState } from 'react';
import { loadContent, onAsset, type ContentAsset, type ContentAssetRef } from '../engine/content';

// An imported model file (`import flightCase from '../assets/flight-case.glb'`) as React state: undefined until
// its content is available, then, in the dev server, every new build re-renders the component.
export function useContentAsset(ref: ContentAssetRef): ContentAsset | undefined {
  const [asset, setAsset] = useState<ContentAsset>();
  useEffect(() => onAsset(ref, setAsset), [ref.key]);
  return asset;
}

// The first static mesh of an imported model file, loaded from the newest build that has it.
export function useContentMesh(ref: ContentAssetRef): UE.StaticMesh | undefined {
  const asset = useContentAsset(ref);
  const [mesh, setMesh] = useState<UE.StaticMesh>();
  useEffect(() => {
    if (asset?.meshes[0]) setMesh(loadContent<UE.StaticMesh>(asset.meshes[0]));
  }, [asset]);
  return mesh;
}
