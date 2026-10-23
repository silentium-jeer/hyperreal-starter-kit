import * as UE from 'ue';
import { useRef } from 'react';
import type { ContentAssetRef } from '../../../shared/engine/content';
import { useContentMesh, useFrame } from '../../../shared/react';
import type { Vector3 } from '../../../shared/react/props';

// An imported model file on a turntable: a placeholder cube until the content pipeline has built it, then the
// imported Nanite mesh, swapped in place each time the file is saved again.
export interface LiveAssetProps {
  asset: ContentAssetRef;
  at: Vector3;
  turnDegreesPerSecond?: number;
}

const PLACEHOLDER = '/Engine/BasicShapes/Cube.Cube';

export function LiveAsset({ asset, at, turnDegreesPerSecond = 20 }: LiveAssetProps) {
  const mesh = useContentMesh(asset);
  const actor = useRef<UE.StaticMeshActor>(null);
  const yaw = useRef(0);
  useFrame((deltaSeconds) => {
    yaw.current = (yaw.current + turnDegreesPerSecond * deltaSeconds) % 360;
    actor.current?.K2_SetActorRotation(new UE.Rotator(0, yaw.current, 0), false);
  });
  return <staticMeshActor ref={actor} location={at} staticMeshComponent={{ mobility: UE.EComponentMobility.Movable, staticMesh: mesh ?? PLACEHOLDER }} />;
}
