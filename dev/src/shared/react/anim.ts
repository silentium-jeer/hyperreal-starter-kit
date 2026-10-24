import * as UE from 'ue';
import type { Key, ReactNode, Ref } from 'react';
import type { HostNode } from './renderer';

// Animation graphs as elements: an <animGraph> inside a character (or a skeletal mesh component) runs the tree of
// anim nodes under it on that mesh, through UVgeAnimInstance (Source/VibeGameEngine/Public/VgeAnimInstance.h).
// The tree goes to the engine whole when its shape changes (SetGraph); a changed prop goes alone (SetNodeParam).
// A prop given as param('name') follows the graph variable of that name, set every frame without React through
// the <animGraph>'s ref: graph.current.SetFloat('speed', value). State machine conditions read the same variables.

export interface AnimParam {
  readonly param: string;
}
export const param = (name: string): AnimParam => ({ param: name });

type AnimNumber = number | AnimParam;
type AnimBool = boolean | AnimParam;
type AnimVector = readonly [AnimNumber, AnimNumber, AnimNumber];
type Asset<T> = string | T;
// EAlphaBlendOption by name.
type BlendType = 'Linear' | 'Cubic' | 'HermiteCubic' | 'Sinusoidal' | 'QuadraticInOut' | 'CubicInOut' | 'QuarticInOut' | 'QuinticInOut' | 'CircularIn' | 'CircularOut' | 'CircularInOut' | 'ExpIn' | 'ExpOut' | 'ExpInOut' | 'Custom';
type BoneSpace = 'world' | 'component' | 'parentBone' | 'bone';

interface AnimElement {
  key?: Key;
}
interface WithPoses extends AnimElement {
  children?: ReactNode;
}

export interface AnimGraphElement extends AnimElement {
  ref?: Ref<UE.VgeAnimInstance>;
  children?: ReactNode;
}
export interface ClipElement extends AnimElement {
  sequence: Asset<UE.AnimSequenceBase>;
  playRate?: AnimNumber;
  loop?: AnimBool;
  startPosition?: number;
}
export interface BlendSpaceElement extends AnimElement {
  blendSpace: Asset<UE.BlendSpace>;
  x?: AnimNumber;
  y?: AnimNumber;
  playRate?: AnimNumber;
  loop?: AnimBool;
}
// Children: pose A, then pose B; alpha 0 is all A, 1 all B.
export interface BlendElement extends WithPoses {
  alpha: AnimNumber;
}
interface BlendListSettings extends WithPoses {
  // Seconds to blend to each pose (one number for all).
  blendTime?: AnimNumber | readonly AnimNumber[];
  transition?: 'blend' | 'inertialization';
  blendType?: BlendType;
  blendProfile?: Asset<UE.BlendProfile>;
  customCurve?: Asset<UE.CurveFloat>;
  childUpdate?: 'default' | 'reset' | 'always';
}
// Children: the poses; the active one by index.
export interface BlendListElement extends BlendListSettings {
  index: AnimNumber;
}
// Children: the pose while true, then the pose while false.
export interface BlendByBoolElement extends BlendListSettings {
  active: AnimBool;
}
// An Animation Blueprint's AnimGraph as a node; children feed its input poses, in order.
export interface LinkedGraphElement extends WithPoses {
  instanceClass: Asset<UE.Class>;
}
// Smooths every pose change requested below it (a transition or blend list with inertialization).
export interface InertializeElement extends WithPoses {
  defaultBlendProfile?: Asset<UE.BlendProfile>;
  filteredCurves?: readonly string[];
  filteredBones?: readonly string[];
  resetOnBecomingRelevant?: boolean;
  tag?: string;
}
// Children: <state>s and <transition>s.
export interface StateMachineElement extends WithPoses {
  entry?: string;
  maxTransitionsPerFrame?: number;
}
// Child: the pose played in the state.
export interface StateElement extends WithPoses {
  name: string;
  alwaysResetOnEntry?: boolean;
}
// Taken, in the order written, from `from` ("*" for any state) when `when` holds: graph variables, timeRemaining
// (seconds left in the state's animation), timeElapsed, numbers, true/false, ! * / + - < <= > >= == != && ||.
export interface TransitionElement extends AnimElement {
  from: string;
  to: string;
  when?: string;
  duration?: AnimNumber;
  blend?: 'crossfade' | 'inertialization';
  blendType?: BlendType;
  blendProfile?: Asset<UE.BlendProfile>;
}
export interface BranchFilter {
  bone: string;
  depth?: number;
}
// Children: the base pose, then one pose per layer; each layer replaces the bones below its branches.
export interface LayeredElement extends WithPoses {
  layers: readonly (BranchFilter | readonly BranchFilter[])[];
  weights?: readonly AnimNumber[];
  meshSpaceRotationBlend?: boolean;
  rootSpaceRotationBlend?: boolean;
  meshSpaceScaleBlend?: boolean;
  curveBlend?: 'Override' | 'DoNotOverride' | 'NormalizeByWeight' | 'BlendByWeight' | 'UseBasePose' | 'UseMaxValue' | 'UseMinValue';
}
// Where montages on this slot play (Montage_Play, PlaySlotAnimationAsDynamicMontage on the graph's ref).
export interface SlotElement extends WithPoses {
  name?: string;
  alwaysUpdateSource?: boolean;
}
export interface TwoBoneIKElement extends WithPoses {
  ikBone: string;
  effectorLocation?: AnimVector;
  effectorSpace?: BoneSpace;
  effectorBone?: string;
  jointTargetLocation?: AnimVector;
  jointTargetSpace?: BoneSpace;
  jointTargetBone?: string;
  alpha?: AnimNumber;
  allowStretching?: boolean;
  startStretchRatio?: number;
  maxStretchScale?: number;
  takeRotationFromEffectorSpace?: boolean;
  maintainEffectorRelRot?: boolean;
  allowTwist?: boolean;
}

export interface AnimIntrinsicElements {
  animGraph: AnimGraphElement;
  clip: ClipElement;
  blendSpace: BlendSpaceElement;
  blend: BlendElement;
  blendList: BlendListElement;
  blendByBool: BlendByBoolElement;
  blendByInt: BlendListElement;
  blendByEnum: BlendListElement;
  linkedGraph: LinkedGraphElement;
  inertialize: InertializeElement;
  stateMachine: StateMachineElement;
  state: StateElement;
  transition: TransitionElement;
  layered: LayeredElement;
  slot: SlotElement;
  twoBoneIK: TwoBoneIKElement;
}

// Element type -> node type of the description.
const NODE_TYPES: Record<string, string> = {
  clip: 'clip',
  blendSpace: 'blendSpace',
  blend: 'blend',
  blendList: 'blendList',
  blendByBool: 'blendList',
  blendByInt: 'blendList',
  blendByEnum: 'blendList',
  linkedGraph: 'linkedGraph',
  inertialize: 'inertialize',
  stateMachine: 'stateMachine',
  state: 'state',
  transition: 'transition',
  layered: 'layered',
  slot: 'slot',
  twoBoneIK: 'twoBoneIK',
};
export const isAnimElement = (type: string) => type === 'animGraph' || type in NODE_TYPES;

const NOT_PROPS = new Set(['children', 'key', 'ref']);

// A prop as the description carries it: engine objects by path.
const encode = (value: any): any => (value instanceof UE.Object ? UE.KismetSystemLibrary.GetPathName(value) : Array.isArray(value) ? value.map(encode) : value);

function describe(node: HostNode): object {
  const props = Object.fromEntries(Object.entries(node.props).filter(([prop]) => !NOT_PROPS.has(prop)).map(([prop, value]) => [prop, encode(value)]));
  return { id: String(node.animId), type: NODE_TYPES[node.type], props, children: node.children.map(describe) };
}

// The skeletal mesh an <animGraph> animates: its parent component, or its parent actor's mesh.
function meshOf(graph: HostNode): UE.SkeletalMeshComponent {
  const parent = graph.parent;
  const target = parent?.object;
  if (target instanceof UE.SkeletalMeshComponent) return target;
  if (target instanceof UE.Character) return target.Mesh;
  if (target instanceof UE.Actor) {
    const mesh = target.GetComponentByClass(UE.SkeletalMeshComponent.StaticClass());
    if (mesh) return mesh as UE.SkeletalMeshComponent;
  }
  throw new Error('<animGraph> belongs inside a character, an actor with a skeletal mesh, or a <skeletalMeshComponent>');
}

export const graphOf = (node: HostNode | null): HostNode | undefined =>
  !node || node.kind !== 'anim' ? undefined : node.type === 'animGraph' ? node : graphOf(node.parent);

function submit(graph: HostNode) {
  const root = graph.children[0];
  if (graph.children.length > 1) console.error('[react] <animGraph> takes one root node; the rest are ignored');
  (graph.object as UE.VgeAnimInstance).SetGraph(root ? JSON.stringify(describe(root)) : '');
}

export function mountGraph(graph: HostNode) {
  const mesh = meshOf(graph);
  // Puts the mesh in Animation Blueprint mode and initializes the instance at once (a registered mesh).
  mesh.SetAnimInstanceClass(UE.VgeAnimInstance.StaticClass());
  graph.object = mesh.GetAnimInstance();
  graph.mesh = mesh;
  submit(graph);
}

export function unmountGraph(graph: HostNode) {
  if (graph.mesh && UE.KismetSystemLibrary.IsValid(graph.mesh)) graph.mesh.SetAnimInstanceClass(null);
  graph.object = graph.mesh = undefined;
}

// Graphs whose shape changed in this commit, sent once it is complete.
const reshaped = new Set<HostNode>();
export function reshape(node: HostNode | null) {
  const graph = graphOf(node);
  if (graph) reshaped.add(graph);
}
export function submitReshaped() {
  for (const graph of reshaped) if (graph.mounted && graph.object) submit(graph);
  reshaped.clear();
}

export function updateAnimNode(node: HostNode, oldProps: Record<string, any>, newProps: Record<string, any>) {
  node.props = newProps;
  const graph = graphOf(node);
  if (!graph?.mounted || !graph.object || node === graph) return;
  const changed = [...new Set([...Object.keys(oldProps), ...Object.keys(newProps)])].filter(
    (prop) => !NOT_PROPS.has(prop) && JSON.stringify(encode(oldProps[prop])) !== JSON.stringify(encode(newProps[prop])),
  );
  // A prop taken away goes back to the node's default: the node is made anew, as a new id, with the graph.
  if (changed.some((prop) => newProps[prop] === undefined)) {
    node.animId = newAnimId();
    reshape(node);
    return;
  }
  for (const prop of changed) (graph.object as UE.VgeAnimInstance).SetNodeParam(String(node.animId), prop, JSON.stringify(encode(newProps[prop])));
}

let nextAnimId = 1;
export const newAnimId = () => nextAnimId++;
