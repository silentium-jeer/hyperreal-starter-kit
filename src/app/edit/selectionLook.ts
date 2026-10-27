import * as UE from 'ue';
import { loadContent, onMaterial } from '../../shared/engine/content';
import { world } from '../../shared/engine/world';
import { isA } from '../../shared/react/catalog';
import type { HostNode } from '../../shared/react/renderer';
import { overrideProp, propsOf } from './devtools';
import { editState, type Selected } from './editState';
import outline from './outline.material';

const SELECTED_STENCIL = 1;
const ACTIVE_STENCIL = 2;
const CUSTOM_DEPTH_WITH_STENCIL = 3;
const MESH_OF_ACTOR = ['staticMeshComponent', 'skeletalMeshComponent', 'mesh'];

interface StencilProps {
  renderCustomDepth: boolean;
  customDepthStencilValue: number;
}

const stencilOf = (value: number): StencilProps => ({ renderCustomDepth: value > 0, customDepthStencilValue: value });
const UNMARKED = stencilOf(0);

function meshPropOf(node: HostNode): string | undefined {
  if (isA(node.className, 'MeshComponent')) return '';
  if (node.kind !== 'actor') return undefined;
  return MESH_OF_ACTOR.find((prop) => node.object?.[prop.charAt(0).toUpperCase() + prop.slice(1)] !== undefined);
}

function markedOf(fiber: any, meshProp: string): StencilProps {
  const props = meshProp ? propsOf(fiber)[meshProp] ?? {} : propsOf(fiber);
  return { renderCustomDepth: props.renderCustomDepth ?? false, customDepthStencilValue: props.customDepthStencilValue ?? 0 };
}

function mark(fiber: any, meshProp: string, stencil: StencilProps) {
  const current = markedOf(fiber, meshProp);
  if (current.renderCustomDepth === stencil.renderCustomDepth && current.customDepthStencilValue === stencil.customDepthStencilValue) return;
  if (!meshProp) {
    overrideProp(fiber, 'renderCustomDepth', stencil.renderCustomDepth);
    overrideProp(fiber, 'customDepthStencilValue', stencil.customDepthStencilValue);
    return;
  }
  overrideProp(fiber, meshProp, { ...(propsOf(fiber)[meshProp] ?? {}), ...stencil });
}

interface Marked {
  meshProp: string;
  base: StencilProps;
  fiber: any;
}

const marked = new Map<HostNode, Marked>();

function apply(selected: Selected, active: boolean) {
  const fiber = selected.chain[0];
  const meshProp = meshPropOf(selected.node);
  if (meshProp === undefined || !fiber) return;
  let entry = marked.get(selected.node);
  if (!entry) marked.set(selected.node, (entry = { meshProp, base: markedOf(fiber, meshProp), fiber }));
  entry.fiber = fiber;
  mark(fiber, meshProp, stencilOf(active ? ACTIVE_STENCIL : SELECTED_STENCIL));
}

function clear(node: HostNode) {
  const entry = marked.get(node);
  marked.delete(node);
  const fiber = entry?.fiber ?? node.fiber;
  if (!entry || !node.mounted || !fiber) return;
  mark(fiber, entry.meshProp, entry.base.customDepthStencilValue ? entry.base : UNMARKED);
}

let volume: UE.PostProcessVolume | undefined;
let stopWatching: (() => void) | undefined;
let previousCustomDepth: number | undefined;

function blendOnly(target: UE.PostProcessVolume, material: UE.MaterialInterface) {
  const settings = target.Settings;
  const blendables = UE.NewArray(UE.WeightedBlendable);
  blendables.Add(new UE.WeightedBlendable(1, material));
  settings.WeightedBlendables = new UE.WeightedBlendables(blendables);
  target.Settings = settings;
}

function showOutline() {
  if (volume) return;
  previousCustomDepth = UE.KismetSystemLibrary.GetConsoleVariableIntValue('r.CustomDepth');
  if (previousCustomDepth !== CUSTOM_DEPTH_WITH_STENCIL) UE.KismetSystemLibrary.ExecuteConsoleCommand(world, `r.CustomDepth ${CUSTOM_DEPTH_WITH_STENCIL}`);
  const transform = new UE.Transform();
  const spawned = UE.GameplayStatics.BeginDeferredActorSpawnFromClass(world, UE.PostProcessVolume.StaticClass(), transform, UE.ESpawnActorCollisionHandlingMethod.AlwaysSpawn, undefined, UE.ESpawnActorScaleMethod.MultiplyWithRoot) as UE.PostProcessVolume;
  spawned.bUnbound = true;
  UE.GameplayStatics.FinishSpawningActor(spawned, transform, UE.ESpawnActorScaleMethod.MultiplyWithRoot);
  volume = spawned;
  stopWatching = onMaterial(outline, (material) => {
    const loaded = loadContent<UE.MaterialInterface>(material.path);
    if (loaded && volume) blendOnly(volume, loaded);
  });
}

function hideOutline() {
  stopWatching?.();
  stopWatching = undefined;
  if (volume && UE.KismetSystemLibrary.IsValid(volume)) volume.K2_DestroyActor();
  volume = undefined;
  if (previousCustomDepth !== undefined && previousCustomDepth !== CUSTOM_DEPTH_WITH_STENCIL) UE.KismetSystemLibrary.ExecuteConsoleCommand(world, `r.CustomDepth ${previousCustomDepth}`);
  previousCustomDepth = undefined;
}

export function showSelection() {
  showOutline();
  const selectedNodes = new Set(editState.selection.map((selected) => selected.node));
  for (const node of [...marked.keys()]) if (!selectedNodes.has(node)) clear(node);
  editState.selection.forEach((selected, index) => apply(selected, index === editState.selection.length - 1));
}

export function hideSelection() {
  for (const node of [...marked.keys()]) clear(node);
  hideOutline();
}
