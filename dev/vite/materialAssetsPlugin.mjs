// Material modules (`*.material.tsx`) are assets of the game code, as model files are: the game imports a handle per
// export in their place (content/materials.mjs handleModule), and a material reaches the game only when code
// imports its module.
//   import lava from '../assets/lava.material';
//   <staticMeshComponent overrideMaterials={[lava]} />
// `onImport(file, key)` runs when the game code first loads the module and returns the handle module's code (the dev
// server describes it and starts its build; the release build builds it and bakes in the paths). Edits are taken by
// the dev server's own watcher (server.mjs), since a material module also depends on what it imports.
import { relative } from 'node:path';
import { MATERIAL_MODULE } from '../content/materials.mjs';

export function materialAssetsPlugin({ root, onImport }) {
  const keyOf = (file) => relative(root, file).replaceAll('\\', '/');
  return {
    name: 'vge:material-assets',
    enforce: 'pre',
    applyToEnvironment: (environment) => environment.name === 'unreal',
    async load(id) {
      const [file] = id.split('?');
      if (!MATERIAL_MODULE.test(file)) return;
      return { code: await onImport(file, keyOf(file)), moduleType: 'js' };
    },
    // The handle module changes only when the exports do; the dev server reloads it then (server.mjs).
    hotUpdate({ file, modules }) {
      if (MATERIAL_MODULE.test(file) && modules.length) return [];
    },
  };
}
