import * as UE from 'ue';
import { createContext } from 'react';
import Reconciler from 'react-reconciler';
import { ConcurrentRoot, DefaultEventPriority, NoEventPriority } from 'react-reconciler/constants';
import { isA, classNameOf, isElementClass } from './catalog';
import { isReserved, same, transformChanged, transformOf, toRotator, toVector, writeProp, writeProps } from './apply';
import { isMaterialValue, materialKeyOf, materialRefsIn, watchMaterials } from './materials';
import { isAnimElement, mountGraph, newAnimId, reshape, submitReshaped, unmountGraph, updateAnimNode } from './anim';
import { $ref } from 'puerts';

// The scene renderer: React elements named after engine classes (Typing/ue/ue-jsx.d.ts) become actors and
// components in the world. Static meshes that need nothing of their own are packed the way a Packed Level Actor
// packs them: one instanced component per descriptor (VgeInstancePool), one instance per element.
// Animation graph elements (<animGraph> and its nodes, anim.ts) are the 'anim' kind: not engine objects, a graph
// description the mesh's anim instance runs.

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
  // Anim nodes: the node's id in the graph description; an <animGraph>: the mesh it animates.
  animId?: number;
  mesh?: UE.SkeletalMeshComponent;
  // The material handles among the props (materials.ts) and the subscription that rewrites them with each new build.
  materialWatch?: string;
  stopMaterials?: () => void;
}

export interface SceneContainer {
  world: UE.World;
  children: HostNode[];
}

const hasHandlers = (props: Record<string, any>) => Object.keys(props).some((prop) => /^on[A-Z]/.test(prop) && typeof props[prop] === 'function');

// What a Packed Level Actor would pack, minus what an element can ask of its own component: physics, events,
// or a ref to hold it by.
function kindOf(className: string, props: Record<string, any>): Kind {
  if (isA(className, 'Actor')) return 'actor';
  const packable = className === 'StaticMeshComponent' && !props.simulatePhysics && !hasHandlers(props) && props.ref === undefined;
  return packable ? 'packed' : 'component';
}

let pool: UE.VgeInstancePool | undefined;
const poolOf = (world: UE.World) => (pool ??= UE.SubsystemBlueprintLibrary.GetWorldSubsystem(world, UE.VgeInstancePool.StaticClass()) as UE.VgeInstancePool);

// One template component per distinct set of mesh props: the descriptor VgeInstancePool groups by is read from it.
const templates = new Map<string, UE.StaticMeshComponent>();
function templateFor(world: UE.World, props: Record<string, any>) {
  const meshProps = Object.fromEntries(Object.entries(props).filter(([prop]) => !['children', 'key', 'ref', 'location', 'rotation', 'scale'].includes(prop)));
  // Engine objects (meshes, materials) enter the key by path: the same asset is the same group. A material handle
  // enters it by the asset it has now, so its next build makes a new group.
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

function mountPacked(world: UE.World, node: HostNode) {
  const transform = UE.KismetMathLibrary.ComposeTransforms(transformOf(node.props), worldTransformOf(node.parent));
  node.instance = poolOf(world).AddInstance(templateFor(world, node.props), transform);
}

function mountActor(world: UE.World, node: HostNode) {
  const cls = (UE as any)[node.className].StaticClass();
  const relative = transformOf(node.props);
  const transform = UE.KismetMathLibrary.ComposeTransforms(relative, worldTransformOf(node.parent));
  const actor = UE.GameplayStatics.BeginDeferredActorSpawnFromClass(world, cls, transform, UE.ESpawnActorCollisionHandlingMethod.AlwaysSpawn, undefined, UE.ESpawnActorScaleMethod.MultiplyWithRoot);
  writeProps(actor, node.props);
  UE.GameplayStatics.FinishSpawningActor(actor, transform, UE.ESpawnActorScaleMethod.MultiplyWithRoot);
  node.object = actor;
  const parentComponent = attachParentOf(node.parent);
  if (parentComponent) actor.K2_AttachToComponent(parentComponent, 'None', UE.EAttachmentRule.KeepWorld, UE.EAttachmentRule.KeepWorld, UE.EAttachmentRule.KeepWorld, false);
}

// The scene component a child attaches to: the parent component itself, or the parent actor's root.
function attachParentOf(node: HostNode | null): UE.SceneComponent | undefined {
  if (!node) return undefined;
  if (node.kind === 'actor') return (node.object as UE.Actor).K2_GetRootComponent();
  if (node.kind === 'component') return node.object instanceof UE.SceneComponent ? node.object : attachParentOf(node.parent);
  return undefined;
}

function mountComponent(world: UE.World, node: HostNode) {
  let owner = ownerActorOf(node.parent);
  // A component written at the root, or under packed content only, gets an actor of its own to live in.
  if (!owner) {
    owner = UE.GameplayStatics.BeginDeferredActorSpawnFromClass(world, UE.Actor.StaticClass(), worldTransformOf(node.parent), UE.ESpawnActorCollisionHandlingMethod.AlwaysSpawn, undefined, UE.ESpawnActorScaleMethod.MultiplyWithRoot);
    UE.GameplayStatics.FinishSpawningActor(owner, worldTransformOf(node.parent), UE.ESpawnActorScaleMethod.MultiplyWithRoot);
    node.holder = owner;
  }
  const component = UE.NewObject((UE as any)[node.className].StaticClass(), owner) as UE.ActorComponent;
  writeProps(component, node.props);
  if (component instanceof UE.SceneComponent) {
    const parent = node.holder ? undefined : attachParentOf(node.parent);
    if (parent) component.K2_AttachToComponent(parent, 'None', UE.EAttachmentRule.KeepRelative, UE.EAttachmentRule.KeepRelative, UE.EAttachmentRule.KeepRelative, false);
    // AActor::SetRootComponent is not a UFunction; the property is what it writes.
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

// A material handle among an element's props is written again each time its material gets a new build: a packed
// element joins the group of the new asset, any other element gets the new asset in its own property.
function rewriteMaterials(world: UE.World, node: HostNode) {
  if (!node.mounted || node.hidden) return;
  if (node.kind === 'packed') {
    if (node.instance) poolOf(world).RemoveInstance(node.instance);
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
  syncMaterials(world, node);
  for (const child of node.children) mount(world, child);
}

function unmount(world: UE.World, node: HostNode) {
  if (!node.mounted) return;
  node.stopMaterials?.();
  node.stopMaterials = node.materialWatch = undefined;
  for (const child of node.children) unmount(world, child);
  if (node.kind === 'anim' && node.type === 'animGraph') unmountGraph(node);
  else if (node.kind === 'packed' && node.instance) poolOf(world).RemoveInstance(node.instance);
  else if (node.kind === 'component' && UE.KismetSystemLibrary.IsValid(node.object)) node.object.K2_DestroyComponent(node.object);
  else if (node.kind === 'actor' && UE.KismetSystemLibrary.IsValid(node.object)) node.object.K2_DestroyActor();
  if (node.holder && UE.KismetSystemLibrary.IsValid(node.holder)) node.holder.K2_DestroyActor();
  node.object = node.holder = node.instance = undefined;
  node.mounted = false;
}

// Packed descendants carry world transforms; when an ancestor moves, they move with it.
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
      poolOf(world).RemoveInstance(node.instance!);
      mountPacked(world, node);
    } else if (transformChanged(oldProps, newProps)) {
      poolOf(world).UpdateInstance(node.instance!, UE.KismetMathLibrary.ComposeTransforms(transformOf(newProps), worldTransformOf(node.parent)));
    }
    return;
  }
  writeProps(node.object, newProps, oldProps);
  if (!transformChanged(oldProps, newProps)) return;
  if (node.kind === 'actor') {
    const transform = UE.KismetMathLibrary.ComposeTransforms(transformOf(newProps), worldTransformOf(node.parent));
    (node.object as UE.Actor).K2_SetActorLocationAndRotation(transform.GetLocation(), transform.Rotator(), false, sweep, true);
    (node.object as UE.Actor).SetActorScale3D(transform.GetScale3D());
  } else if (node.object instanceof UE.SceneComponent) {
    setRelativeTransform(node.object, newProps);
  }
  refreshPacked(world, node);
}

function setHidden(world: UE.World, node: HostNode, hidden: boolean) {
  node.hidden = hidden;
  if (node.kind === 'anim') return;
  if (node.kind === 'packed') {
    if (hidden && node.instance) poolOf(world).RemoveInstance(node.instance);
    else if (!hidden) mountPacked(world, node);
  } else if (node.kind === 'actor') {
    (node.object as UE.Actor).SetActorHiddenInGame(hidden);
  } else if (node.object instanceof UE.SceneComponent) {
    node.object.SetHiddenInGame(hidden, true);
  }
}

// Anim nodes live inside an <animGraph>, and an <animGraph> holds anim nodes only.
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

  createInstance(type: string, props: Props): HostNode {
    if (isAnimElement(type)) {
      return { type, className: type, kind: 'anim', props, parent: null, children: [], mounted: false, hidden: false, animId: type === 'animGraph' ? undefined : newAnimId() };
    }
    const className = classNameOf(type);
    if (!isElementClass(className)) throw new Error(`<${type}> is not an engine actor or component class (Typing/ue/ue-jsx.json)`);
    return { type, className, kind: kindOf(className, props), props, parent: null, children: [], mounted: false, hidden: false };
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
  // React treats a null host context as missing (requiredContext); scenes need no context, so one empty object.
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
      // A static mesh that starts needing its own component (physics, events, a ref) leaves the pack, and back.
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
  getInstanceFromNode: () => null,
  beforeActiveInstanceBlur: () => {},
  afterActiveInstanceBlur: () => {},
  prepareScopeUpdate: () => {},
  getInstanceFromScope: () => null,
} as any);

// Registers the renderer with the DevTools hook, which is how React Fast Refresh (src/app/refresh.ts) finds and
// re-renders its roots when a component module is edited.
reconciler.injectIntoDevTools();

// The world a commit works in. One scene root renders at a time (the open scene), so the renderer keeps it.
let currentWorld: UE.World | undefined;
const world = () => currentWorld!;

export interface SceneRoot {
  render(element: React.ReactNode): void;
  unmount(): void;
}

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
  };
}
