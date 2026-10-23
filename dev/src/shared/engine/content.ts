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
interface Manifest {
  pak: string;
  plugin: string;
  build: number;
  assets: Record<string, { build: number; objects: ContentObject[] }>;
}
type AssetListener = (asset: ContentAsset) => void;

declare const __vge: { content?: { mounted: Set<string>; manifest: Manifest | null; listeners: Map<string, Set<AssetListener>> } };

// Lives on the bootstrap global: mounted containers and subscribers survive re-evaluation of this module.
const live = (__vge.content ??= { mounted: new Set(), manifest: null, listeners: new Map() });

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
    if (!live.mounted.has(manifest.pak)) {
      if (!gameInstance.MountContent(manifest.pak, manifest.plugin)) {
        console.error(`[content] could not mount ${manifest.pak}`);
        return;
      }
      live.mounted.add(manifest.pak);
    }
    const previous = live.manifest;
    live.manifest = manifest;
    for (const [key, listeners] of live.listeners) {
      const entry = manifest.assets[key];
      if (entry && previous?.assets[key]?.build !== entry.build) notify(key, describe(entry.build, entry.objects), listeners);
    }
    console.log(`[content] build ${manifest.build} mounted, assets: ${Object.keys(manifest.assets).join(', ')}`);
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
