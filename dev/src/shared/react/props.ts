import type * as UE from 'ue';
import type { Key, ReactNode, Ref } from 'react';

// Shapes the generated element props (Typing/ue/ue-jsx.d.ts) are built from.

export type Vector3 = readonly [number, number, number];

// A struct prop takes the struct itself or, for the structs scenes write all the time, a tuple.
export type StructProp<T> = T extends UE.Vector
  ? T | Vector3
  : T extends UE.Rotator
    ? T | Vector3
    : T extends UE.LinearColor
      ? T | Vector3 | readonly [number, number, number, number]
      : T extends UE.Vector2D
        ? T | readonly [number, number]
        : T;

interface ElementBase {
  key?: Key;
  children?: ReactNode;
}

// An actor's world transform when it is a root element, relative to its parent actor when nested.
export interface ActorElement extends ElementBase {
  location?: StructProp<UE.Vector>;
  rotation?: StructProp<UE.Rotator>;
  scale?: number | StructProp<UE.Vector>;
}

// A component's transform relative to what it is attached to (scene components only).
export interface ComponentElement extends ElementBase {
  location?: StructProp<UE.Vector>;
  rotation?: StructProp<UE.Rotator>;
  scale?: number | StructProp<UE.Vector>;
}

export interface ElementRef<T> {
  ref?: Ref<T>;
}
