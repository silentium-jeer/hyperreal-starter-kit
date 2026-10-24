import * as UE from 'ue';
import { gameInstance, own } from './world';

// Content from model files the game code imports (`import flightCase from '../assets/flight-case.glb'`,
// vite/contentAssetsPlugin.mjs). In the dev server the content pipeline builds each imported file into a
// container this process mounts; in the release build the objects are cooked into the game and their paths
// are part of the handle.
export interface ContentObject {
  path: string;
  class: string;
}

// The default export of an imported model file.
export interface ContentAssetRef {
  // The file's path relative to the dev folder, e.g. "src/features/demo/assets/flight-case.glb".
  readonly key: string;
  // Release build only: the objects cooked into the game.
  readonly objects?: ContentObject[];
}

export interface ContentAsset {
  build: number;
  meshes: string[];
  skeletalMeshes: string[];
  animations: string[];
  objects: ContentObject[];
}
// An asset pack added from Fab (dev/content/fab.mjs): its own content under /Game/<name>/, cooked into a container
// of its own with its own shader library.
export interface ContentPack {
  name: string;
  pak: string;
  shaderLibrary: string;
  build: number;
}
interface Manifest {
  pak: string | null;
  plugin: string;
  build: number;
  assets: Record<string, { build: number; objects: ContentObject[] }>;
  packs: Record<string, ContentPack>;
}
type AssetListener = (asset: ContentAsset) => void;
type PackListener = (pack: ContentPack) => void;

interface LiveContent {
  mounted: Set<string>;
  manifest: Manifest | null;
  listeners: Map<string, Set<AssetListener>>;
  packListeners?: Map<string, Set<PackListener>>;
}
declare const __vge: { content?: LiveContent };

// Lives on the bootstrap global: mounted containers and subscribers survive re-evaluation of this module.
const live: LiveContent = (__vge.content ??= { mounted: new Set(), manifest: null, listeners: new Map() });
const packListeners = (live.packListeners ??= new Map());

export function contentAsset(key: string, objects?: ContentObject[]): ContentAssetRef {
  return { key, objects };
}

// The file's name as Interchange names what it imports from it: .../flight-case.glb -> FlightCase
// (content/decode.mjs assetName).
export const assetName = (ref: ContentAssetRef) =>
  ref.key
    .replace(/^.*\//, '')
    .replace(/\.[^.]+$/, '')
    .replace(/[^A-Za-z0-9]+(.)?/g, (_, c: string | undefined) => (c ? c.toUpperCase() : ''))
    .replace(/^./, (c) => c.toUpperCase());

function describe(build: number, objects: ContentObject[]): ContentAsset {
  const byClass = (cls: string) => objects.filter((o) => o.class === cls).map((o) => o.path);
  return { build, meshes: byClass('StaticMesh'), skeletalMeshes: byClass('SkeletalMesh'), animations: byClass('AnimSequence'), objects };
}

// Loads one object of a content asset; logs (and returns undefined) when the mounted builds lack it.
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

// Vite runs HMR event listeners under Promise.allSettled, so anything thrown here would vanish: log it.
function apply(manifest: Manifest | null) {
  try {
    if (!manifest) return;
    if (manifest.pak && !live.mounted.has(manifest.pak)) {
      if (!gameInstance.MountContent(manifest.pak, manifest.plugin, '')) {
        console.error(`[content] could not mount ${manifest.pak}`);
        return;
      }
      live.mounted.add(manifest.pak);
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
    console.log(`[content] build ${manifest.build} mounted, assets: ${Object.keys(manifest.assets).join(', ')}; packs: ${Object.keys(manifest.packs ?? {}).join(', ')}`);
  } catch (err: any) {
    console.error(`[content] applying build ${manifest?.build} failed: ${err?.stack ?? err}`);
  }
}

// Calls `listener` with the content of an imported model file as soon as it is available and, in the dev
// server, again each time the file is saved and rebuilt. The subscription belongs to the open scene; the
// returned function ends it earlier.
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

// Calls `listener` once the asset pack `name` (Content/<name>, added from Fab) is mounted, and again after each
// rebuild of it; its objects then load by path: loadContent(`/Game/${name}/Meshes/SM_Rock.SM_Rock`). The
// subscription belongs to the open scene; the returned function ends it earlier.
export function onPack(name: string, listener: PackListener) {
  if (!packListeners.has(name)) packListeners.set(name, new Set());
  packListeners.get(name)!.add(listener);
  const pack = live.manifest?.packs?.[name];
  if (pack) notifyPack(pack, [listener]);
  return own(() => packListeners.get(name)?.delete(listener));
}

// onAsset for the first static mesh of the asset.
export function onMesh(ref: ContentAssetRef, listener: (mesh: UE.StaticMesh) => void) {
  return onAsset(ref, (asset) => {
    const mesh = asset.meshes[0] && loadContent<UE.StaticMesh>(asset.meshes[0]);
    if (mesh) listener(mesh);
  });
}

if (import.meta.hot) {
  import.meta.hot.on('vge:content', apply);
  import.meta.hot.on('vge:content-error', (e: { file: string; message: string }) => console.error(`[content] ${e.file}: ${e.message}`));
  // Also after a reconnect: the server may have built new versions while this process was cut off.
  import.meta.hot.send('vge:content-sync');
}
