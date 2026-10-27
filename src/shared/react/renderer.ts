import * as UE from 'ue';
import { createContext } from 'react';
import Reconciler from 'react-reconciler';
import { ConcurrentRoot, DefaultEventPriority, NoEventPriority } from 'react-reconciler/constants';
import { isA, classNameOf, isElementClass } from './catalog';
import { isReserved, same, transformChanged, transformOf, toRotator, toVector, writeProp, writeProps } from './apply';
import { isMaterialValue, materialKeyOf, materialRefsIn, watchMaterials } from './materials';
import { isAnimElement, mountGraph, newAnimId, readoptGraphs, reshape, submitReshaped, unmountGraph, updateAnimNode } from './anim';
import { $ref } from 'puerts';
import { isLive } from '../engine/world';


type Kind = 'actor' | 'component' | 'packed' | 'anim';

export interface HostNode {
  type: string;
  className: string;
  kind: Kind;
  props: Record<string, any>;
  parent: HostNode | null;
  children: HostNode[];
  mounted: boolean;
  hidden: boolean;
  object?: any;
  holder?: UE.Actor;
  instance?: UE.VgeInstance;
  animId?: number;
  mesh?: UE.SkeletalMeshComponent;
  materialWatch?: string;
  stopMaterials?: () => void;
  fiber?: any;
}

export interface SceneContainer {
  world: UE.World;
  children: HostNode[];
}

const hasHandlers = (props: Record<string, any>) => Object.keys(props).some((prop) => /^on[A-Z]/.test(prop) && typeof props[prop] === 'function');

function kindOf(className: string, props: Record<string, any>): Kind {
  if (isA(className, 'Actor')) return 'actor';
  const packable = className === 'StaticMeshComponent' && !props.simulatePhysics && !hasHandlers(props) && props.ref === undefined;
  return packable ? 'packed' : 'component';
}

let pool: UE.VgeInstancePool | undefined;
const poolOf = (world: UE.World) => (pool ??= UE.SubsystemBlueprintLibrary.GetWorldSubsystem(world, UE.VgeInstancePool.StaticClass()) as UE.VgeInstancePool);

const templates = new Map<string, UE.StaticMeshComponent>();
function templateFor(world: UE.World, props: Record<string, any>) {
  const meshProps = Object.fromEntries(Object.entries(props).filter(([prop]) => !['children', 'key', 'ref', 'location', 'rotation', 'scale'].includes(prop)));
  const sorted = Object.keys(meshProps).sort().map((prop) => [prop, meshProps[prop]]);
  const key = JSON.stringify(sorted, (_, value) => (value instanceof UE.Object ? UE.KismetSystemLibrary.GetPathName(value) : isMaterialValue(value) ? materialKeyOf(value) : value));
  let template = templates.get(key);
  if (!template) {
    template = UE.NewObject(UE.StaticMeshComponent.StaticClass(), poolOf(world)) as UE.StaticMeshComponent;
    writeProps(template, meshProps);
    templates.set(key, template);
  }
  return template;
}

function worldTransformOf(node: HostNode | null): UE.Transform {
  if (!node) return new UE.Transform();
  if (node.kind === 'actor') return (node.object as UE.Actor).GetTransform();
  if (node.kind === 'component' && node.object instanceof UE.SceneComponent) return node.object.K2_GetComponentToWorld();
  return worldTransformOf(node.parent);
}

const ownerActorOf = (node: HostNode | null): UE.Actor | undefined =>
  !node ? undefined : node.kind === 'actor' ? node.object : node.holder ?? ownerActorOf(node.parent);

const sweep = $ref(new UE.HitResult());

const nodesByObject = new Map<object, HostNode>();
const shownPacked = new Set<HostNode>();

export const nodeOfObject = (object: object) => nodesByObject.get(object);

export const mountedNodes = () => [...nodesByObject.values(), ...shownPacked];
export const shownPackedNodes = () => shownPacked.values();
export const parentWorldTransformOf = (node: HostNode) => worldTransformOf(node.parent);
export const packedWorldTransformOf = (node: HostNode) => UE.KismetMathLibrary.ComposeTransforms(transformOf(node.props), worldTransformOf(node.parent));

function mountPacked(world: UE.World, node: HostNode) {
  if (node.instance || node.hidden) return;
  node.instance = poolOf(world).AddInstance(templateFor(world, node.props), packedWorldTransformOf(node));
  shownPacked.add(node);
}

function removePacked(world: UE.World, node: HostNode) {
  if (node.instance) poolOf(world).RemoveInstance(node.instance);
  node.instance = undefined;
  shownPacked.delete(node);
}

function mountActor(world: UE.World, node: HostNode) {
  const cls = (UE as any)[node.className].StaticClass();
  const relative = transformOf(node.props);
  const transform = UE.KismetMathLibrary.ComposeTransforms(relative, worldTransformOf(node.parent));
  const actor = UE.GameplayStatics.BeginDeferredActorSpawnFromClass(world, cls, transform, UE.ESpawnActorCollisionHandlingMethod.AlwaysSpawn, undefined, UE.ESpawnActorScaleMethod.MultiplyWithRoot);
  writeProps(actor, node.props);
  UE.GameplayStatics.FinishSpawningActor(actor, transform, UE.ESpawnActorScaleMethod.MultiplyWithRoot);
  actor.K2_SetActorTransform(transform, false, $ref(new UE.HitResult()), true);
  node.object = actor;
  const parentComponent = attachParentOf(node.parent);
  if (parentComponent) actor.K2_AttachToComponent(parentComponent, 'None', UE.EAttachmentRule.KeepWorld, UE.EAttachmentRule.KeepWorld, UE.EAttachmentRule.KeepWorld, false);
}

function attachParentOf(node: HostNode | null): UE.SceneComponent | undefined {
  if (!node) return undefined;
  if (node.kind === 'actor') return (node.object as UE.Actor).K2_GetRootComponent();
  if (node.kind === 'component') return node.object instanceof UE.SceneComponent ? node.object : attachParentOf(node.parent);
  return undefined;
}

function mountComponent(world: UE.World, node: HostNode) {
  let owner = ownerActorOf(node.parent);
  if (!owner) {
    owner = UE.GameplayStatics.BeginDeferredActorSpawnFromClass(world, UE.Actor.StaticClass(), worldTransformOf(node.parent), UE.ESpawnActorCollisionHandlingMethod.AlwaysSpawn, undefined, UE.ESpawnActorScaleMethod.MultiplyWithRoot);
    UE.GameplayStatics.FinishSpawningActor(owner, worldTransformOf(node.parent), UE.ESpawnActorScaleMethod.MultiplyWithRoot);
    node.holder = owner;
  }
  const component = UE.NewObject((UE as any)[node.className].StaticClass(), owner) as UE.ActorComponent;
  writeProps(component, node.props);
  if (component instanceof UE.SceneComponent) {
    const parent = node.holder ? undefined : attachParentOf(node.parent);
    if (parent) component.K2_AttachToComponent(parent, node.props.socket ?? 'None', UE.EAttachmentRule.KeepRelative, UE.EAttachmentRule.KeepRelative, UE.EAttachmentRule.KeepRelative, false);
    else if (!owner.K2_GetRootComponent()) owner.RootComponent = component;
    else component.K2_AttachToComponent(owner.K2_GetRootComponent(), 'None', UE.EAttachmentRule.KeepRelative, UE.EAttachmentRule.KeepRelative, UE.EAttachmentRule.KeepRelative, false);
    setRelativeTransform(component, node.props);
  }
  component.RegisterComponent();
  node.object = component;
}

function setRelativeTransform(component: UE.SceneComponent, props: Record<string, any>) {
  component.K2_SetRelativeLocationAndRotation(toVector(props.location ?? [0, 0, 0]), toRotator(props.rotation ?? [0, 0, 0]), false, sweep, true);
  component.SetRelativeScale3D(toVector(props.scale ?? 1));
}

function rewriteMaterials(world: UE.World, node: HostNode) {
  if (!node.mounted || node.hidden) return;
  if (node.kind === 'packed') {
    removePacked(world, node);
    mountPacked(world, node);
    return;
  }
  const target = node.object;
  if (!target || !UE.KismetSystemLibrary.IsValid(target)) return;
  const className = target.GetClass().GetName();
  let written = false;
  for (const [prop, value] of Object.entries(node.props)) {
    if (isReserved(prop) || !materialRefsIn({ [prop]: value }).length) continue;
    try {
      written = writeProp(target, className, prop, value) || written;
    } catch (err: any) {
      console.error(`[react] ${className}.${prop}: ${err?.message ?? err}`);
    }
  }
  if (written && target instanceof UE.ActorComponent) UE.VgeScriptLibrary.ReregisterComponent(target);
}

function syncMaterials(world: UE.World, node: HostNode) {
  const refs = node.kind === 'anim' ? [] : materialRefsIn(node.props);
  const watch = refs.map((ref) => ref.key).join('|');
  if (watch === (node.materialWatch ?? '')) return;
  node.stopMaterials?.();
  node.materialWatch = watch;
  node.stopMaterials = refs.length ? watchMaterials(refs, () => rewriteMaterials(world, node)) : undefined;
}

function mount(world: UE.World, node: HostNode) {
  if (node.mounted) return;
  if (node.kind === 'packed') mountPacked(world, node);
  else if (node.kind === 'actor') mountActor(world, node);
  else if (node.kind === 'anim') {
    if (node.type === 'animGraph') mountGraph(node);
  } else mountComponent(world, node);
  node.mounted = true;
  if (node.object) nodesByObject.set(node.object, node);
  syncMaterials(world, node);
  for (const child of node.children) mount(world, child);
}

function unmount(world: UE.World, node: HostNode) {
  if (!node.mounted) return;
  node.stopMaterials?.();
  node.stopMaterials = node.materialWatch = undefined;
  for (const child of node.children) unmount(world, child);
  if (node.kind === 'anim' && node.type === 'animGraph') unmountGraph(node);
  else if (node.kind === 'packed') removePacked(world, node);
  else if (node.kind === 'component' && isLive(node.object)) node.object.K2_DestroyComponent(node.object);
  else if (node.kind === 'actor' && isLive(node.object)) node.object.K2_DestroyActor();
  if (isLive(node.holder)) node.holder!.K2_DestroyActor();
  if (node.object) nodesByObject.delete(node.object);
  node.object = node.holder = node.instance = undefined;
  node.mounted = false;
}

function refreshPacked(world: UE.World, node: HostNode) {
  for (const child of node.children) {
    if (child.kind === 'packed' && child.instance) {
      poolOf(world).UpdateInstance(child.instance, UE.KismetMathLibrary.ComposeTransforms(transformOf(child.props), worldTransformOf(node)));
    } else {
      refreshPacked(world, child);
    }
  }
}

function update(world: UE.World, node: HostNode, oldProps: Record<string, any>, newProps: Record<string, any>) {
  node.props = newProps;
  syncMaterials(world, node);
  if (node.kind === 'packed') {
    const meshChanged = Object.keys({ ...oldProps, ...newProps }).some((prop) => !['children', 'key', 'location', 'rotation', 'scale'].includes(prop) && !same(oldProps[prop], newProps[prop]));
    if (meshChanged) {
      removePacked(world, node);
      mountPacked(world, node);
    } else if (transformChanged(oldProps, newProps) && node.instance) {
      poolOf(world).UpdateInstance(node.instance, UE.KismetMathLibrary.ComposeTransforms(transformOf(newProps), worldTransformOf(node.parent)));
    }
    return;
  }
  writeProps(node.object, newProps, oldProps);
  readoptGraphs(node);
  if (!transformChanged(oldProps, newProps)) return;
  const changed = changedTransformParts(oldProps, newProps);
  if (node.kind === 'actor') writeChangedActorTransform(node.object as UE.Actor, changed, UE.KismetMathLibrary.ComposeTransforms(transformOf(newProps), worldTransformOf(node.parent)));
  else if (node.object instanceof UE.SceneComponent) writeChangedRelativeTransform(node.object, changed, newProps);
  refreshPacked(world, node);
}

interface TransformParts {
  location: boolean;
  rotation: boolean;
  scale: boolean;
}

const changedTransformParts = (oldProps: Props, newProps: Props): TransformParts => ({
  location: !same(oldProps.location, newProps.location),
  rotation: !same(oldProps.rotation, newProps.rotation),
  scale: !same(oldProps.scale, newProps.scale),
});

function writeChangedActorTransform(actor: UE.Actor, changed: TransformParts, worldTransform: UE.Transform) {
  if (changed.location) actor.K2_SetActorLocation(worldTransform.GetLocation(), false, sweep, true);
  if (changed.rotation) actor.K2_SetActorRotation(worldTransform.Rotator(), true);
  if (changed.scale) actor.SetActorScale3D(worldTransform.GetScale3D());
}

function writeChangedRelativeTransform(component: UE.SceneComponent, changed: TransformParts, props: Props) {
  if (changed.location) component.K2_SetRelativeLocation(toVector(props.location ?? [0, 0, 0]), false, sweep, true);
  if (changed.rotation) component.K2_SetRelativeRotation(toRotator(props.rotation ?? [0, 0, 0]), false, sweep, true);
  if (changed.scale) component.SetRelativeScale3D(toVector(props.scale ?? 1));
}

function setHidden(world: UE.World, node: HostNode, hidden: boolean) {
  node.hidden = hidden;
  if (node.kind === 'anim') return;
  if (node.kind === 'packed') {
    if (hidden) removePacked(world, node);
    else mountPacked(world, node);
  } else if (node.kind === 'actor') {
    (node.object as UE.Actor).SetActorHiddenInGame(hidden);
  } else if (node.object instanceof UE.SceneComponent) {
    node.object.SetHiddenInGame(hidden, true);
  }
}

function checkNesting(parent: HostNode | null, child: HostNode) {
  if (child.kind === 'anim' && child.type !== 'animGraph' && parent?.kind !== 'anim') throw new Error(`<${child.type}> belongs inside an <animGraph>`);
  if (child.kind === 'anim' && child.type === 'animGraph' && parent?.kind === 'anim') throw new Error('<animGraph> cannot be inside another animation element');
  if (child.kind !== 'anim' && parent?.kind === 'anim') throw new Error(`<${child.type}> cannot be inside <${parent.type}>; it holds animation nodes`);
}

let updatePriority: number = NoEventPriority;

type Props = Record<string, any>;
const HOST_CONTEXT = {};

const reconciler = Reconciler({
  rendererPackageName: 'vge-scene',
  rendererVersion: '1.0.0',
  supportsMutation: true,
  supportsPersistence: false,
  supportsHydration: false,
  isPrimaryRenderer: false,
  supportsMicrotasks: true,
  scheduleMicrotask: queueMicrotask,
  scheduleTimeout: setTimeout,
  cancelTimeout: clearTimeout,
  noTimeout: -1,

  createInstance(type: string, props: Props, _container: SceneContainer, _context: object, fiber: any): HostNode {
    if (isAnimElement(type)) {
      return { type, className: type, kind: 'anim', props, parent: null, children: [], mounted: false, hidden: false, animId: type === 'animGraph' ? undefined : newAnimId(), fiber };
    }
    const className = classNameOf(type);
    if (!isElementClass(className)) throw new Error(`<${type}> is not an engine actor or component class (Typing/ue/ue-jsx.json)`);
    return { type, className, kind: kindOf(className, props), props, parent: null, children: [], mounted: false, hidden: false, fiber };
  },
  createTextInstance(text: string): never {
    throw new Error(`text "${text}" cannot be part of a scene; scene elements are actors and components`);
  },
  appendInitialChild(parent: HostNode, child: HostNode) {
    checkNesting(parent, child);
    child.parent = parent;
    parent.children.push(child);
  },
  finalizeInitialChildren: () => false,
  shouldSetTextContent: () => false,
  getRootHostContext: () => HOST_CONTEXT,
  getChildHostContext: (parentContext: object) => parentContext,
  getPublicInstance: (node: HostNode) => node.object ?? node,
  prepareForCommit: () => null,
  resetAfterCommit: submitReshaped,
  preparePortalMount: () => {},

  appendChildToContainer(container: SceneContainer, child: HostNode) {
    checkNesting(null, child);
    container.children = container.children.filter((node) => node !== child);
    container.children.push(child);
    child.parent = null;
    mount(container.world, child);
  },
  insertInContainerBefore(container: SceneContainer, child: HostNode, before: HostNode) {
    checkNesting(null, child);
    container.children = container.children.filter((node) => node !== child);
    container.children.splice(Math.max(0, container.children.indexOf(before)), 0, child);
    child.parent = null;
    mount(container.world, child);
  },
  removeChildFromContainer(container: SceneContainer, child: HostNode) {
    container.children = container.children.filter((node) => node !== child);
    unmount(container.world, child);
  },
  appendChild(parent: HostNode, child: HostNode) {
    checkNesting(parent, child);
    parent.children = parent.children.filter((node) => node !== child);
    parent.children.push(child);
    child.parent = parent;
    if (parent.mounted) mount(world(), child);
    reshape(parent);
  },
  insertBefore(parent: HostNode, child: HostNode, before: HostNode) {
    checkNesting(parent, child);
    parent.children = parent.children.filter((node) => node !== child);
    parent.children.splice(Math.max(0, parent.children.indexOf(before)), 0, child);
    child.parent = parent;
    if (parent.mounted) mount(world(), child);
    reshape(parent);
  },
  removeChild(parent: HostNode, child: HostNode) {
    parent.children = parent.children.filter((node) => node !== child);
    unmount(world(), child);
    reshape(parent);
  },
  clearContainer(container: SceneContainer) {
    for (const child of container.children) unmount(container.world, child);
    container.children = [];
  },

  commitUpdate(node: HostNode, _type: string, oldProps: Props, newProps: Props) {
    if (node.kind === 'anim') {
      updateAnimNode(node, oldProps, newProps);
      return;
    }
    const kind = kindOf(node.className, newProps);
    if (kind !== node.kind) {
      unmount(world(), node);
      node.kind = kind;
      node.props = newProps;
      mount(world(), node);
      return;
    }
    update(world(), node, oldProps, newProps);
  },
  commitTextUpdate: () => {},
  hideInstance: (node: HostNode) => setHidden(world(), node, true),
  unhideInstance: (node: HostNode) => setHidden(world(), node, false),
  hideTextInstance: () => {},
  unhideTextInstance: () => {},
  detachDeletedInstance: () => {},

  getCurrentUpdatePriority: () => updatePriority,
  setCurrentUpdatePriority: (priority: number) => {
    updatePriority = priority;
  },
  resolveUpdatePriority: () => (updatePriority !== NoEventPriority ? updatePriority : DefaultEventPriority),
  resolveEventType: () => null,
  resolveEventTimeStamp: () => -1.1,
  shouldAttemptEagerTransition: () => false,
  trackSchedulerEvent: () => {},
  requestPostPaintCallback: () => {},
  maySuspendCommit: () => false,
  maySuspendCommitOnUpdate: () => false,
  maySuspendCommitInSyncRender: () => false,
  preloadInstance: () => true,
  startSuspendingCommit: () => {},
  suspendInstance: () => {},
  waitForCommitToBeReady: () => null,
  NotPendingTransition: null,
  HostTransitionContext: createContext(null) as any,
  resetFormInstance: () => {},
  getInstanceFromNode: (node: HostNode) => node.fiber ?? null,
  beforeActiveInstanceBlur: () => {},
  afterActiveInstanceBlur: () => {},
  prepareScopeUpdate: () => {},
  getInstanceFromScope: () => null,
} as any);

reconciler.injectIntoDevTools();

export const flushSceneWork = () => reconciler.flushSyncWork();

let currentWorld: UE.World | undefined;
const world = () => currentWorld!;

export interface SceneRoot {
  render(element: React.ReactNode): void;
  unmount(): void;
  owns(node: HostNode): boolean;
}

const topNodeOf = (node: HostNode) => {
  let top = node;
  while (top.parent) top = top.parent;
  return top;
};

const report = (kind: string) => (error: any) => console.error(`[react] ${kind}: ${error?.stack ?? error}`);

export function createSceneRoot(targetWorld: UE.World): SceneRoot {
  currentWorld = targetWorld;
  const container: SceneContainer = { world: targetWorld, children: [] };
  const root = reconciler.createContainer(container, ConcurrentRoot, null, false, null, '', report('uncaught'), report('caught'), report('recoverable'), () => {}, null);
  return {
    render(element) {
      reconciler.updateContainerSync(element, root, null, null);
      reconciler.flushSyncWork();
    },
    unmount() {
      reconciler.updateContainerSync(null, root, null, null);
      reconciler.flushSyncWork();
    },
    owns: (node) => container.children.includes(topNodeOf(node)),
  };
}
