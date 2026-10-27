import * as UE from 'ue';
import { useEffect, useState } from 'react';
import { loadContent, onAsset, type ContentAsset, type ContentAssetRef } from '../engine/content';

export function useContentAsset(ref: ContentAssetRef | undefined): ContentAsset | undefined {
  const [asset, setAsset] = useState<ContentAsset>();
  useEffect(() => {
    setAsset(undefined);
    return ref ? onAsset(ref, setAsset) : undefined;
  }, [ref?.key]);
  return asset;
}

export function useContentMesh(ref: ContentAssetRef): UE.StaticMesh | undefined {
  const asset = useContentAsset(ref);
  const [mesh, setMesh] = useState<UE.StaticMesh>();
  useEffect(() => {
    if (asset?.meshes[0]) setMesh(loadContent<UE.StaticMesh>(asset.meshes[0]));
  }, [asset]);
  return mesh;
}
