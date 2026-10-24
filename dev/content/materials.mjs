// Material modules (`*.material.tsx`, dev/src/shared/material): evaluated in Node in a Vite environment of their own
// (`materials`, a runnable server environment: the game never runs them), described as content service requests by
// dev/src/shared/material/describe.ts, and turned into the handle module the game imports in their place.
import { relative } from 'node:path';

export const MATERIAL_MODULE = /\.material\.[jt]sx$/;
const DESCRIBE = '/src/shared/material/describe.ts';
const CONTENT_MODULE = '/src/shared/engine/content.ts';

// `environment()` is the `materials` environment (RunnableDevEnvironment); `folderRoot` the content path assets go
// under (/VgeLive/Materials in the dev server, /Game/Vge/Imported/... in the release build: a function of the key).
export function createMaterialModules({ root, environment, folderRoot }) {
  const keyOf = (file) => relative(root, file).replaceAll('\\', '/');
  const urlOf = (file) => `/${keyOf(file)}`;
  // Definitions exported by every material module evaluated so far, by object: their asset names.
  let names = new WeakMap();
  // One evaluation at a time: a re-evaluation clears the runner's cache.
  let chain = Promise.resolve();

  const nodesOf = (file) => [...(environment().moduleGraph.getModulesByFile(file.replaceAll('\\', '/')) ?? [])];

  // The material modules `file` imports, directly or not, dependencies first.
  function materialDependencies(file) {
    const seen = new Set();
    const order = [];
    const visit = (node) => {
      for (const dep of node.importedModules) {
        if (!dep.file || seen.has(dep.file)) continue;
        seen.add(dep.file);
        visit(dep);
        if (MATERIAL_MODULE.test(dep.file) && dep.file !== file.replaceAll('\\', '/')) order.push(dep.file);
      }
    };
    nodesOf(file).forEach(visit);
    return order;
  }

  // Every material module whose description depends on `file` (itself included when it is one).
  function affectedBy(file) {
    const found = new Set();
    const seen = new Set();
    const visit = (node) => {
      if (seen.has(node)) return;
      seen.add(node);
      if (node.file && MATERIAL_MODULE.test(node.file)) found.add(node.file);
      node.importers.forEach(visit);
    };
    nodesOf(file).forEach(visit);
    if (MATERIAL_MODULE.test(file)) found.add(file.replaceAll('\\', '/'));
    return [...found];
  }

  // A changed file is evaluated again from its source.
  function invalidate(file) {
    const env = environment();
    for (const node of nodesOf(file)) env.moduleGraph.invalidateModule(node);
    env.runner.clearCache();
    names = new WeakMap();
  }

  // The exports of a material module as MaterialExport[] (describe.ts).
  function describe(file) {
    const run = chain.then(async () => {
      const runner = environment().runner;
      const { describeModule } = await runner.import(DESCRIBE);
      const exports = await runner.import(urlOf(file));
      const rootFor = (key) => (typeof folderRoot === 'function' ? folderRoot(key) : folderRoot);
      for (const dep of materialDependencies(file)) describeModule(keyOf(dep), await runner.import(urlOf(dep)), rootFor(keyOf(dep)), names);
      return describeModule(keyOf(file), exports, rootFor(keyOf(file)), names);
    });
    chain = run.catch(() => {});
    return run;
  }

  return { keyOf, describe, invalidate, affectedBy };
}

// The module the game imports in place of a material module: a handle per export (shared/engine/content.ts
// materialAsset). `paths` (release build) bakes in each export's cooked object path.
export function handleModule(exports, paths = {}) {
  const lines = [`import { materialAsset } from '${CONTENT_MODULE}';`];
  for (const entry of exports) {
    const handle = { kind: entry.kind, key: entry.exportKey, usage: entry.usage, params: entry.params, ...(paths[entry.exportKey] ? { path: paths[entry.exportKey] } : {}) };
    const value = `materialAsset(${JSON.stringify(handle)})`;
    lines.push(entry.exportName === 'default' ? `export default ${value};` : `export const ${entry.exportName} = ${value};`);
  }
  return `${lines.join('\n')}\n`;
}
