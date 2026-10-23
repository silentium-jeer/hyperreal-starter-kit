// Model files are modules of the game code, the way Vite treats every asset: a model reaches the game only when
// code imports it, and nothing is picked up from a folder.
//   import flightCase from '../assets/flight-case.glb';
// The module's default export is the asset's handle (shared/engine/content.ts contentAsset): its key is the
// file's path relative to the dev folder. In the dev server the handle is filled by the content pipeline's
// builds; in the release build it carries the imported objects' paths.
import { relative } from 'node:path';

const MODEL = /\.(glb|gltf|fbx)$/i;
const CONTENT_MODULE = '/src/shared/engine/content.ts';

// `onImport(file, key)` runs when the game code first loads the file and returns the objects to bake into the
// module (release build) or nothing (dev server, where the pipeline sends them when built).
// `onChange(file, key)` runs when an imported file is saved again.
export function contentAssetsPlugin({ root, onImport, onChange }) {
  const keyOf = (file) => relative(root, file).replaceAll('\\', '/');
  return {
    name: 'vge:content-assets',
    // Ahead of Vite's own asset plugin, which would make .glb/.gltf a URL string.
    enforce: 'pre',
    applyToEnvironment: (environment) => environment.name === 'unreal',
    async load(id) {
      const [file] = id.split('?');
      if (!MODEL.test(file)) return;
      const key = keyOf(file);
      const objects = await onImport(file, key);
      const args = objects ? `${JSON.stringify(key)}, ${JSON.stringify(objects)}` : JSON.stringify(key);
      return { code: `import { contentAsset } from '${CONTENT_MODULE}';\nexport default contentAsset(${args});\n`, moduleType: 'js' };
    },
    // A saved model rebuilds its asset; the module itself stays (its handle is the same), so no code reloads.
    hotUpdate({ file, modules }) {
      if (!MODEL.test(file) || modules.length === 0) return;
      onChange?.(file, keyOf(file));
      return [];
    },
  };
}
