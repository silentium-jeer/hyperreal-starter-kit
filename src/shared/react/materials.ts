import * as UE from 'ue';
import { currentMaterial, loadContent, onMaterial, type ContentMaterial } from '../engine/content';
import { world } from '../engine/world';
import { isMaterialValue, type MaterialParamType, type MaterialParamValues, type MaterialRef, type MaterialValue } from '../material';


export { isMaterialValue };

const refOf = (value: MaterialValue): MaterialRef => (value.kind === 'dynamic' ? value.base : value);

function requiredUsages(target: UE.Object): string[] {
  const needed: string[] = [];
  const packed = target instanceof UE.StaticMeshComponent && target.GetOuter() instanceof UE.VgeInstancePool;
  if (packed || target instanceof UE.InstancedStaticMeshComponent) needed.push('InstancedStaticMeshes');
  if (target instanceof UE.StaticMeshComponent && (target.StaticMesh?.GetNumNaniteTriangles() ?? 0) > 0) needed.push('Nanite');
  if (target instanceof UE.SkinnedMeshComponent) needed.push('SkeletalMesh');
  return needed;
}

const reported = new Set<string>();
function reportOnce(message: string) {
  if (reported.has(message)) return;
  reported.add(message);
  console.error(message);
}

function checkUsage(target: UE.Object, asset: ContentMaterial, key: string) {
  const declared = new Set(asset.usage.map((u) => u.toLowerCase()));
  const missing = requiredUsages(target).filter((u) => !declared.has(u.toLowerCase()));
  if (missing.length) {
    reportOnce(`[material] ${key} is used on ${target.GetName()} (${target.GetClass().GetName()}), which needs usage ${missing.map((u) => `'${u.charAt(0).toLowerCase()}${u.slice(1)}'`).join(', ')}; add it to the <material usage={[...]}> list, or the engine draws the default material there`);
  }
}

function setParams(mid: UE.MaterialInstanceDynamic, values: MaterialParamValues, types: Record<string, MaterialParamType>, key: string) {
  for (const [name, value] of Object.entries(values)) {
    const type = types[name];
    if (type === 'scalar' && typeof value === 'number') mid.SetScalarParameterValue(name, value);
    else if (type === 'vector' && Array.isArray(value)) mid.SetVectorParameterValue(name, new UE.LinearColor(value[0] ?? 0, value[1] ?? 0, value[2] ?? 0, value[3] ?? 1));
    else if (type === 'texture' && typeof value === 'string') {
      const texture = loadContent<UE.Texture>(value);
      if (texture) mid.SetTextureParameterValue(name, texture);
    } else reportOnce(`[material] instance of ${key}: '${name}' is ${type ? `a ${type} parameter, given ${JSON.stringify(value)}` : `not a parameter of it (parameters: ${Object.keys(types).join(', ') || 'none'})`}`);
  }
}

const dynamics = new WeakMap<object, Map<string, { mid: UE.MaterialInstanceDynamic; parent: string; names: string[] }>>();

export function resolveMaterial(target: UE.Object, slot: string, value: MaterialValue): UE.MaterialInterface | undefined {
  const ref = refOf(value);
  const asset = currentMaterial(ref);
  if (!asset) return undefined;
  checkUsage(target, asset, ref.key);
  const material = loadContent<UE.MaterialInterface>(asset.path);
  if (!material || value.kind !== 'dynamic') return material;
  let slots = dynamics.get(target);
  if (!slots) dynamics.set(target, (slots = new Map()));
  let entry = slots.get(slot);
  const names = Object.keys(value.params);
  const dropped = entry?.names.some((name) => !names.includes(name));
  if (!entry || dropped || entry.parent !== asset.path || !UE.KismetSystemLibrary.IsValid(entry.mid)) {
    entry = { mid: UE.KismetMaterialLibrary.CreateDynamicMaterialInstance(world, material), parent: asset.path, names };
    slots.set(slot, entry);
  }
  entry.names = names;
  setParams(entry.mid, value.params, asset.params, ref.key);
  return entry.mid;
}

export function materialRefsIn(props: Record<string, any>, refs = new Map<string, MaterialRef>()): MaterialRef[] {
  for (const [prop, value] of Object.entries(props)) {
    if (prop === 'children') continue;
    for (const item of Array.isArray(value) ? value : [value]) {
      if (isMaterialValue(item)) refs.set(refOf(item).key, refOf(item));
      else if (item && typeof item === 'object' && Object.getPrototypeOf(item) === Object.prototype && !('$$typeof' in item)) materialRefsIn(item, refs);
    }
  }
  return [...refs.values()];
}

export function watchMaterials(refs: MaterialRef[], onChange: () => void): () => void {
  const stops = refs.map((ref) => {
    let last = currentMaterial(ref)?.path;
    return onMaterial(ref, (material) => {
      if (material.path === last) return;
      last = material.path;
      onChange();
    });
  });
  return () => stops.forEach((stop) => stop());
}

export const materialKeyOf = (value: MaterialValue) => {
  const asset = currentMaterial(refOf(value));
  return `${refOf(value).key}@${asset?.path ?? 'unbuilt'}${value.kind === 'dynamic' ? JSON.stringify(value.params) : ''}`;
};
