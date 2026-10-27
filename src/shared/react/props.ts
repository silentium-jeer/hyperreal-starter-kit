import type * as UE from 'ue';
import type { Key, ReactNode, Ref } from 'react';
import type { MaterialValue } from '../material/types';


export type Vector3 = readonly [number, number, number];

export type StructProp<T> = T extends UE.Vector
  ? T | Vector3
  : T extends UE.Rotator
    ? T | Vector3
    : T extends UE.LinearColor
      ? T | Vector3 | readonly [number, number, number, number]
      : T extends UE.Vector2D
        ? T | readonly [number, number]
        : T;

export type ObjectProp<T> = T | string | (T extends UE.MaterialInterface ? MaterialValue : never);

interface ElementBase {
  key?: Key;
  children?: ReactNode;
}

export interface ActorElement extends ElementBase {
  location?: StructProp<UE.Vector>;
  rotation?: StructProp<UE.Rotator>;
  scale?: number | StructProp<UE.Vector>;
}

export interface ComponentElement extends ElementBase {
  location?: StructProp<UE.Vector>;
  rotation?: StructProp<UE.Rotator>;
  scale?: number | StructProp<UE.Vector>;
  socket?: string;
}

export interface ElementRef<T> {
  ref?: Ref<T>;
}
