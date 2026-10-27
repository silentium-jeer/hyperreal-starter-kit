import * as UE from 'ue';
import type { MaterialParamType, MaterialRef } from '../material/types';
import type { NiagaraSystemRef } from '../niagara';
import { gameInstance, own } from './world';

export interface ContentObject {
  path: string;
  class: string;
}

export interface ContentAssetRef {
  readonly key: string;
  readonly objects?: ContentObject[];
}

export interface ContentAsset {
  build: number;
  meshes: string[];
  skeletalMeshes: string[];
  animations: string[];
  sounds: string[];
  objects: ContentObject[];
}
export interface ContentPack {
  name: string;
  pak: string;
  shaderLibrary: string;
  build: number;
}
export interface ContentMaterial {
  path: string;
  class: string;
  kind: 'material' | 'instance';
  usage: string[];
  params: Record<string, MaterialParamType>;
  build: number;
}
export interface ContentNiagara {
  path: string;
  user: NiagaraSystemRef['user'];
  build: number;
}
interface ContentContainer {
  name: string;
  pak: string;
  shaderLibrary: string;
  build: number;
}
interface Manifest {
  plugin: string;
  build: number;
  containers: ContentContainer[];
  assets: Record<string, { build: number; objects: ContentObject[] }>;
  materials?: Record<string, ContentMaterial>;
  niagara?: Record<string, ContentNiagara>;
  packs: Record<string, ContentPack>;
}
type AssetListener = (asset: ContentAsset) => void;
type PackListener = (pack: ContentPack) => void;
type MaterialListener = (material: ContentMaterial) => void;
type NiagaraListener = (system: ContentNiagara) => void;

interface LiveContent {
  mounted: Set<string>;
  manifest: Manifest | null;
  listeners: Map<string, Set<AssetListener>>;
  packListeners?: Map<string, Set<PackListener>>;
  materialListeners?: Map<string, Set<MaterialListener>>;
  niagaraListeners?: Map<string, Set<NiagaraListener>>;
}
declare const __vge: { content?: LiveContent };

const live: LiveContent = (__vge.content ??= { mounted: new Set(), manifest: null, listeners: new Map() });
const packListeners = (live.packListeners ??= new Map());
const materialListeners = (live.materialListeners ??= new Map());
const niagaraListeners = (live.niagaraListeners ??= new Map());

export function contentAsset(key: string, objects?: ContentObject[]): ContentAssetRef {
  return { key, objects };
}

export const assetName = (ref: ContentAssetRef) =>
  ref.key
    .replace(/^.*\//, '')
    .replace(/\.[^.]+$/, '')
    .replace(/[^A-Za-z0-9]+(.)?/g, (_, c: string | undefined) => (c ? c.toUpperCase() : ''))
    .replace(/^./, (c) => c.toUpperCase());

function describe(build: number, objects: ContentObject[]): ContentAsset {
  const byClass = (cls: string) => objects.filter((o) => o.class === cls).map((o) => o.path);
  return { build, meshes: byClass('StaticMesh'), skeletalMeshes: byClass('SkeletalMesh'), animations: byClass('AnimSequence'), sounds: byClass('SoundWave'), objects };
}

export function loadContent<T extends UE.Object>(path: string): T | undefined {
  const object = UE.Object.Load(path) as T | undefined;
  if (!object) console.error(`[content] ${path} is not loadable from build ${live.manifest?.build ?? 'release'}`);
  return object;
}

function notify(key: string, asset: ContentAsset, listeners: Iterable<AssetListener>) {
  for (const listener of listeners) {
    try {
      listener(asset);
    } catch (err: any) {
      console.error(`[content] ${key} listener failed: ${err?.stack ?? err}`);
    }
  }
}

const UNMOUNT_AFTER_MS = 5000;
const unmounting = new Set<string>();
function unmountSuperseded(manifest: Manifest) {
  const current = new Set([...(manifest.containers ?? []).map((container) => container.pak), ...Object.values(manifest.packs ?? {}).map((pack) => pack.pak)]);
  const superseded = [...live.mounted].filter((pak) => !current.has(pak) && !unmounting.has(pak));
  if (!superseded.length) return;
  for (const pak of superseded) unmounting.add(pak);
  setTimeout(() => {
    for (const pak of superseded) {
      unmounting.delete(pak);
      if (live.manifest && [...(live.manifest.containers ?? []).map((container) => container.pak)].includes(pak)) continue;
      gameInstance.UnmountContent(pak);
      live.mounted.delete(pak);
    }
  }, UNMOUNT_AFTER_MS);
}

function apply(manifest: Manifest | null) {
  try {
    if (!manifest) return;
    for (const container of manifest.containers ?? []) {
      if (live.mounted.has(container.pak)) continue;
      if (!gameInstance.MountContent(container.pak, manifest.plugin, container.shaderLibrary)) {
        console.error(`[content] could not mount ${container.pak}`);
        return;
      }
      live.mounted.add(container.pak);
    }
    const previous = live.manifest;
    for (const pack of Object.values(manifest.packs ?? {})) {
      if (live.mounted.has(pack.pak)) continue;
      if (!gameInstance.MountContent(pack.pak, manifest.plugin, pack.shaderLibrary)) {
        console.error(`[content] could not mount pack ${pack.name} (${pack.pak})`);
        continue;
      }
      live.mounted.add(pack.pak);
    }
    live.manifest = manifest;
    for (const [key, listeners] of live.listeners) {
      const entry = manifest.assets[key];
      if (entry && previous?.assets[key]?.build !== entry.build) notify(key, describe(entry.build, entry.objects), listeners);
    }
    for (const [name, listeners] of packListeners) {
      const pack = manifest.packs?.[name];
      if (pack && previous?.packs?.[name]?.build !== pack.build) notifyPack(pack, listeners);
    }
    for (const [key, listeners] of materialListeners) {
      const material = manifest.materials?.[key];
      if (material && previous?.materials?.[key]?.path !== material.path) notifyMaterial(key, material, listeners);
    }
    for (const [key, listeners] of niagaraListeners) {
      const system = manifest.niagara?.[key];
      if (system && previous?.niagara?.[key]?.path !== system.path) notifyNiagara(key, system, listeners);
    }
    console.log(`[content] build ${manifest.build} mounted, assets: ${Object.keys(manifest.assets).join(', ')}; packs: ${Object.keys(manifest.packs ?? {}).join(', ')}`);
    unmountSuperseded(manifest);
  } catch (err: any) {
    console.error(`[content] applying build ${manifest?.build} failed: ${err?.stack ?? err}`);
  }
}

export function onAsset(ref: ContentAssetRef, listener: AssetListener) {
  if (ref.objects) {
    notify(ref.key, describe(0, ref.objects), [listener]);
    return own(() => {});
  }
  if (!live.listeners.has(ref.key)) live.listeners.set(ref.key, new Set());
  live.listeners.get(ref.key)!.add(listener);
  const entry = live.manifest?.assets[ref.key];
  if (entry) notify(ref.key, describe(entry.build, entry.objects), [listener]);
  return own(() => live.listeners.get(ref.key)?.delete(listener));
}

function notifyPack(pack: ContentPack, listeners: Iterable<PackListener>) {
  for (const listener of listeners) {
    try {
      listener(pack);
    } catch (err: any) {
      console.error(`[content] pack ${pack.name} listener failed: ${err?.stack ?? err}`);
    }
  }
}

export function onPack(name: string, listener: PackListener) {
  if (!packListeners.has(name)) packListeners.set(name, new Set());
  packListeners.get(name)!.add(listener);
  const pack = live.manifest?.packs?.[name];
  if (pack) notifyPack(pack, [listener]);
  return own(() => packListeners.get(name)?.delete(listener));
}

function notifyMaterial(key: string, material: ContentMaterial, listeners: Iterable<MaterialListener>) {
  for (const listener of listeners) {
    try {
      listener(material);
    } catch (err: any) {
      console.error(`[content] material ${key} listener failed: ${err?.stack ?? err}`);
    }
  }
}

export function materialAsset(ref: MaterialRef): MaterialRef {
  return ref;
}

export function currentMaterial(ref: MaterialRef): ContentMaterial | undefined {
  if (ref.path) return { path: ref.path, class: ref.kind === 'instance' ? 'MaterialInstanceConstant' : 'Material', kind: ref.kind, usage: [...ref.usage], params: { ...ref.params }, build: 0 };
  return live.manifest?.materials?.[ref.key];
}

export function onMaterial(ref: MaterialRef, listener: MaterialListener) {
  const now = currentMaterial(ref);
  if (ref.path) {
    if (now) notifyMaterial(ref.key, now, [listener]);
    return own(() => {});
  }
  if (!materialListeners.has(ref.key)) materialListeners.set(ref.key, new Set());
  materialListeners.get(ref.key)!.add(listener);
  if (now) notifyMaterial(ref.key, now, [listener]);
  return own(() => materialListeners.get(ref.key)?.delete(listener));
}

function notifyNiagara(key: string, system: ContentNiagara, listeners: Iterable<NiagaraListener>) {
  for (const listener of listeners) {
    try {
      listener(system);
    } catch (err: any) {
      console.error(`[content] system ${key} listener failed: ${err?.stack ?? err}`);
    }
  }
}

export function niagaraAsset(ref: NiagaraSystemRef): NiagaraSystemRef {
  return ref;
}

export function currentNiagara(ref: NiagaraSystemRef): ContentNiagara | undefined {
  if (ref.path) return { path: ref.path, user: ref.user, build: 0 };
  return live.manifest?.niagara?.[ref.key];
}

export function onNiagara(ref: NiagaraSystemRef, listener: NiagaraListener) {
  const now = currentNiagara(ref);
  if (ref.path) {
    if (now) notifyNiagara(ref.key, now, [listener]);
    return own(() => {});
  }
  if (!niagaraListeners.has(ref.key)) niagaraListeners.set(ref.key, new Set());
  niagaraListeners.get(ref.key)!.add(listener);
  if (now) notifyNiagara(ref.key, now, [listener]);
  return own(() => niagaraListeners.get(ref.key)?.delete(listener));
}

export function onMesh(ref: ContentAssetRef, listener: (mesh: UE.StaticMesh) => void) {
  return onAsset(ref, (asset) => {
    const mesh = asset.meshes[0] && loadContent<UE.StaticMesh>(asset.meshes[0]);
    if (mesh) listener(mesh);
  });
}

if (import.meta.hot) {
  import.meta.hot.on('vge:content', apply);
  import.meta.hot.on('vge:content-error', (e: { file: string; message: string }) => console.error(`[content] ${e.file}: ${e.message}`));
  import.meta.hot.send('vge:content-sync');
}
