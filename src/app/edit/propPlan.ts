import * as UE from 'ue';
import { packedWorldTransformOf, parentWorldTransformOf, type HostNode } from '../../shared/react/renderer';
import { requestEdit } from './channel';
import { creationStackOf, overrideProp, ownerChainOf, propsOf } from './devtools';
import { editState, report, type AxisTarget, type InspectResult, type Selected, type WholeTarget } from './editState';
import { sub, type Vec3 } from './gizmoMath';
import { toVec3, toVector } from './gizmoView';

const EPSILON = 1e-6;

export function worldTransformOf(node: HostNode): UE.Transform | undefined {
  if (node.kind === 'packed') return node.instance ? packedWorldTransformOf(node) : undefined;
  if (node.kind === 'actor' && node.object) return (node.object as UE.Actor).GetTransform();
  if (node.object instanceof UE.SceneComponent) return node.object.K2_GetComponentToWorld();
  return undefined;
}

export const worldLocationOf = (node: HostNode): Vec3 | undefined => {
  const transform = worldTransformOf(node);
  return transform ? toVec3(transform.GetLocation()) : undefined;
};

export function inspect(selected: Selected) {
  return requestEdit<InspectResult>('inspect', { chain: selected.chain.map(creationStackOf) })
    .then((inspected) => {
      selected.inspected = inspected;
      return inspected;
    })
    .catch((err) => {
      report(`inspect failed: ${err.message}`);
      return undefined;
    });
}

export function selectedOf(node: HostNode): Selected | undefined {
  return node.fiber ? { node, chain: ownerChainOf(node.fiber) } : undefined;
}

export interface PropValue {
  fiber: any;
  prop: string;
  value: number | number[];
  start: number | number[];
  base: unknown;
}

const copyValue = (value: number | number[]) => (Array.isArray(value) ? [...value] : value);

export function resetPlan(plan: Plan) {
  for (const entry of plan.values()) entry.value = copyValue(entry.start);
}

export type Plan = Map<string, PropValue>;

function vectorBase(selected: Selected, target: AxisTarget | WholeTarget): number[] | number | undefined {
  const value = propsOf(selected.chain[target.level])[target.prop];
  if (typeof value === 'number') return value;
  if (Array.isArray(value) && value.length === 3 && value.every((item) => typeof item === 'number')) return [...value];
  return Array.isArray(target.base) ? [...target.base] : target.base;
}

function entryOf(plan: Plan, selected: Selected, target: AxisTarget | WholeTarget, initial: () => number | number[] | undefined) {
  const key = `${editState.selection.indexOf(selected)}:${target.level}:${target.prop}`;
  let entry = plan.get(key);
  if (!entry) {
    const value = initial();
    if (value === undefined) return undefined;
    entry = { fiber: selected.chain[target.level], prop: target.prop, value: copyValue(value), start: copyValue(value), base: propsOf(selected.chain[target.level])[target.prop] };
    plan.set(key, entry);
  }
  return entry;
}

export function addLocationDelta(plan: Plan, selected: Selected, worldDelta: Vec3): string | undefined {
  const origin = worldLocationOf(selected.node);
  const inspected = selected.inspected;
  if (!origin || !inspected) return 'the selection has no source location yet';
  const parent = parentWorldTransformOf(selected.node);
  const from = toVec3(UE.KismetMathLibrary.InverseTransformLocation(parent, toVector(origin)));
  const to = toVec3(UE.KismetMathLibrary.InverseTransformLocation(parent, toVector([origin[0] + worldDelta[0], origin[1] + worldDelta[1], origin[2] + worldDelta[2]])));
  const local = sub(to, from);
  for (const [index, change] of local.entries()) {
    if (Math.abs(change) < EPSILON) continue;
    const target = inspected.axes[index];
    if (!target) return inspected.reasons.find((reason) => reason.startsWith('location')) ?? `location[${index}] cannot be written`;
    const entry = entryOf(plan, selected, target, () => {
      const base = vectorBase(selected, target);
      return Array.isArray(base) ? base : undefined;
    });
    if (!entry || !Array.isArray(entry.value)) return `${target.prop} is not a literal vector`;
    entry.value[target.index] += target.sign * change;
  }
  return undefined;
}

const wrap = (angle: number, near: number) => angle + 360 * Math.round((near - angle) / 360);

function continuousRotator(rotator: UE.Rotator, near: number[]): number[] {
  const direct = [rotator.Pitch, rotator.Yaw, rotator.Roll];
  const flipped = [180 - rotator.Pitch, rotator.Yaw + 180, rotator.Roll + 180];
  const candidates = [direct, flipped].map((candidate) => candidate.map((angle, index) => wrap(angle, near[index] ?? 0)));
  const distance = (candidate: number[]) => candidate.reduce((sum, angle, index) => sum + Math.abs(angle - (near[index] ?? 0)), 0);
  return distance(candidates[0]) <= distance(candidates[1]) ? candidates[0] : candidates[1];
}

export function setWorldRotation(plan: Plan, selected: Selected, worldRotation: UE.Rotator): string | undefined {
  const target = selected.inspected?.rotation;
  if (!target) return selected.inspected?.reasons.find((reason) => reason.startsWith('rotation')) ?? 'rotation cannot be written';
  const relative = UE.KismetMathLibrary.InverseTransformRotation(parentWorldTransformOf(selected.node), worldRotation);
  const entry = entryOf(plan, selected, target, () => {
    const base = vectorBase(selected, target);
    return Array.isArray(base) ? base : [0, 0, 0];
  });
  if (!entry) return 'rotation cannot be written';
  entry.value = continuousRotator(relative, entry.start as number[]);
  return undefined;
}

export function scaleBy(plan: Plan, selected: Selected, factors: Vec3): string | undefined {
  const target = selected.inspected?.scale;
  if (!target) return selected.inspected?.reasons.find((reason) => reason.startsWith('scale')) ?? 'scale cannot be written';
  const entry = entryOf(plan, selected, target, () => vectorBase(selected, target) ?? 1);
  if (!entry) return 'scale cannot be written';
  const base = entry.start;
  const uniform = factors[0] === factors[1] && factors[1] === factors[2];
  entry.value = typeof base === 'number' && uniform ? base * factors[0] : (typeof base === 'number' ? [base, base, base] : base).map((value, index) => value * factors[index]);
  return undefined;
}

export function previewPlan(plan: Plan) {
  for (const entry of plan.values()) overrideProp(entry.fiber, entry.prop, Array.isArray(entry.value) ? [...entry.value] : entry.value);
}

export function revertPlan(plan: Plan) {
  for (const entry of plan.values()) overrideProp(entry.fiber, entry.prop, entry.base);
}

export function commitPlan(plan: Plan) {
  const edits = [...plan.values()].map((entry) => ({ stack: creationStackOf(entry.fiber), prop: entry.prop, value: entry.value }));
  if (!edits.length) return Promise.resolve();
  return requestEdit<{ files: string[] }>('commit', { edits })
    .then(({ files }) => report(files.length ? `wrote ${files.join(', ')}` : 'nothing to write'))
    .catch((err) => {
      revertPlan(plan);
      report(`not written: ${err.message}`);
    });
}
