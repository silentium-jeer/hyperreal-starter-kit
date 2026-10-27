import * as UE from 'ue';
import { $ref, $unref } from 'puerts';

// Engine-side ownership. Everything script code creates in the engine is recorded in a scope:
//   scene - actors, timers and hookups of the open scene; removed when another scene opens
//   app   - hookups that live across scenes (UI host, scene router)
// The scopes live on the bootstrap global, so they survive re-evaluation of this module, and a full
// reload (which calls no module's dispose) removes everything the previous evaluation created.
export type Scope = 'app' | 'scene';
interface Owned {
  actors: Set<UE.Actor>;
  timers: Set<any>;
  disposers: Set<() => void>;
}
const newOwned = (): Owned => ({ actors: new Set(), timers: new Set(), disposers: new Set() });

declare const __vge: { gameInstance: any; scopes?: Record<Scope, Owned> };

export const gameInstance = __vge.gameInstance;
export const world = gameInstance.GetWorld() as UE.World;

const scopes = (__vge.scopes ??= { app: newOwned(), scene: newOwned() });

const ONE = new UE.Vector(1, 1, 1);

export function spawn<T>(cls: any, location: UE.Vector, rotation = new UE.Rotator(0, 0, 0), scale = ONE, setup?: (actor: T) => void): T {
  const transform = UE.KismetMathLibrary.MakeTransform(location, rotation, scale);
  const actor = UE.GameplayStatics.BeginDeferredActorSpawnFromClass(
    world, cls.StaticClass(), transform, UE.ESpawnActorCollisionHandlingMethod.AlwaysSpawn, undefined, UE.ESpawnActorScaleMethod.MultiplyWithRoot,
  ) as T;
  setup?.(actor);
  UE.GameplayStatics.FinishSpawningActor(actor as any, transform, UE.ESpawnActorScaleMethod.MultiplyWithRoot);
  scopes.scene.actors.add(actor as any);
  return actor;
}

// Whether `object` is still a live engine object. Puerts throws "passing a invalid object" when a wrapper whose
// UObject the engine has already released is passed to any function, IsValid included (JsEnvImpl.cpp), as happens to
// actors the engine destroyed itself before a scope's cleanup.
export function isLive(object: UE.Object | undefined | null) {
  if (!object) return false;
  try {
    return UE.KismetSystemLibrary.IsValid(object);
  } catch (error) {
    if (error instanceof Error && error.message === 'passing a invalid object') return false;
    throw error;
  }
}

export function destroy(actor: UE.Actor) {
  scopes.scene.actors.delete(actor);
  if (isLive(actor)) actor.K2_DestroyActor();
}

// setInterval owned by a scope. Returns the function that stops it. A Puerts interval fires on engine frames, late
// by up to a frame and re-timed from when it ran: fine for periodic chores, not for simulation (engine/fixedStep.ts).
export function every(ms: number, fn: () => void, scope: Scope = 'scene') {
  const timer = setInterval(fn, ms);
  scopes[scope].timers.add(timer);
  return () => {
    clearInterval(timer);
    scopes[scope].timers.delete(timer);
  };
}

// Any other engine-side hookup (delegate bindings, UI handlers). `dispose` runs when the scope is
// cleared, or earlier when the returned function is called from the module's own hot dispose.
export function own(dispose: () => void, scope: Scope = 'scene') {
  scopes[scope].disposers.add(dispose);
  return () => {
    if (scopes[scope].disposers.delete(dispose)) dispose();
  };
}

export interface FrameOptions {
  tickEvenWhenPaused?: boolean;
}

interface FrameCallback {
  fn: (deltaSeconds: number) => void;
  tickEvenWhenPaused: boolean;
  reported: boolean;
}

const frameCallbacks = new Set<FrameCallback>();

function dispatchFrame(deltaSeconds: number) {
  const paused = UE.GameplayStatics.IsGamePaused(world);
  for (const callback of frameCallbacks) {
    if (paused && !callback.tickEvenWhenPaused) continue;
    try {
      callback.fn(deltaSeconds);
    } catch (err: any) {
      if (!callback.reported) console.error(`[world] frame callback failed: ${err?.stack ?? err}`);
      callback.reported = true;
    }
  }
}

gameInstance.OnTick.Add(dispatchFrame);
own(() => gameInstance.OnTick.Remove(dispatchFrame), 'app');

export function onFrame(fn: (deltaSeconds: number) => void, { tickEvenWhenPaused = false }: FrameOptions = {}) {
  const callback: FrameCallback = { fn, tickEvenWhenPaused, reported: false };
  frameCallbacks.add(callback);
  return () => {
    frameCallbacks.delete(callback);
  };
}

export function everyFrame(fn: (deltaSeconds: number) => void, scope: Scope = 'scene', options: FrameOptions = {}) {
  return own(onFrame(fn, options), scope);
}

export function disposeScope(scope: Scope) {
  const owned = scopes[scope];
  for (const dispose of [...owned.disposers]) {
    try {
      dispose();
    } catch (err: any) {
      console.error(`[world] dispose in ${scope} failed: ${err?.stack ?? err}`);
    }
  }
  owned.disposers.clear();
  for (const timer of owned.timers) clearInterval(timer);
  owned.timers.clear();
  for (const actor of [...owned.actors]) destroy(actor);
}

import.meta.hot?.on('vite:beforeFullReload', () => {
  disposeScope('scene');
  disposeScope('app');
});

export function countActors(cls: any): number {
  const found = $ref(UE.NewArray(UE.Actor));
  UE.GameplayStatics.GetAllActorsOfClass(world, cls.StaticClass(), found);
  return $unref(found).Num();
}

export function loadMesh(path: string) {
  return UE.Object.Load(path) as UE.StaticMesh;
}

// One material per colour, shared by everything painted with it (and so packed into one instanced group). The
// cache lives on the bootstrap global like the scopes: a full reload keeps the same materials, so the same groups.
const coloredMaterials: Map<string, UE.MaterialInstanceDynamic> = ((__vge as any).coloredMaterials ??= new Map());
export function colored(color: readonly [number, number, number]) {
  const key = color.join(',');
  let material = coloredMaterials.get(key);
  if (!material) {
    const parent = UE.Object.Load('/Engine/BasicShapes/BasicShapeMaterial.BasicShapeMaterial') as UE.MaterialInterface;
    material = UE.KismetMaterialLibrary.CreateDynamicMaterialInstance(world, parent, 'None', UE.EMIDCreationFlags.None);
    material.SetVectorParameterValue('Color', new UE.LinearColor(color[0], color[1], color[2], 1));
    coloredMaterials.set(key, material);
  }
  return material;
}

// A physically based surface, one material per distinct look, on the project's copy of the glTF master
// (/Game/Vge/Materials/Gltf/M_Default: skeletal, Nanite and instanced usage).
export interface Surface {
  color: readonly [number, number, number];
  metallic?: number;
  roughness?: number;
  emissive?: readonly [number, number, number];
  emissiveStrength?: number;
}
const surfaceMaterials: Map<string, UE.MaterialInstanceDynamic> = ((__vge as any).surfaceMaterials ??= new Map());
export function surface({ color, metallic = 0, roughness = 0.5, emissive = [0, 0, 0], emissiveStrength = 1 }: Surface) {
  const key = JSON.stringify([color, metallic, roughness, emissive, emissiveStrength]);
  let material = surfaceMaterials.get(key);
  if (!material) {
    const parent = UE.Object.Load('/Game/Vge/Materials/Gltf/M_Default.M_Default') as UE.MaterialInterface;
    material = UE.KismetMaterialLibrary.CreateDynamicMaterialInstance(world, parent, 'None', UE.EMIDCreationFlags.None);
    material.SetVectorParameterValue('BaseColorFactor', new UE.LinearColor(color[0], color[1], color[2], 1));
    material.SetScalarParameterValue('MetallicFactor', metallic);
    material.SetScalarParameterValue('RoughnessFactor', roughness);
    material.SetVectorParameterValue('EmissiveFactor', new UE.LinearColor(emissive[0], emissive[1], emissive[2], 1));
    material.SetScalarParameterValue('EmissiveStrength', emissiveStrength);
    surfaceMaterials.set(key, material);
  }
  return material;
}

export function meshActor(path: string, location: UE.Vector, scale = ONE, color?: [number, number, number]) {
  return spawn<UE.StaticMeshActor>(UE.StaticMeshActor, location, new UE.Rotator(0, 0, 0), scale, (actor) => {
    actor.StaticMeshComponent.SetMobility(UE.EComponentMobility.Movable);
    actor.StaticMeshComponent.SetStaticMesh(loadMesh(path));
    if (color) actor.StaticMeshComponent.SetMaterial(0, colored(color));
  });
}

export function viewFrom(camera: UE.Actor) {
  UE.GameplayStatics.GetPlayerController(world, 0).SetViewTargetWithBlend(camera, 0, UE.EViewTargetBlendFunction.VTBlend_Linear, 0, false);
}
