// What content/materials.mjs and content/niagara.mjs need from the `materials` environment's module graph: modules that
// are described in Node (material and Niagara modules) depend on what they import, and an edit of any of it describes
// them again.
export function createModuleGraph(environment) {
  const nodesOf = (file) => [...(environment().moduleGraph.getModulesByFile(file.replaceAll('\\', '/')) ?? [])];

  // The modules matching `pattern` that `file` imports, directly or not, dependencies first.
  function dependencies(file, pattern) {
    const seen = new Set();
    const order = [];
    const visit = (node) => {
      for (const dep of node.importedModules) {
        if (!dep.file || seen.has(dep.file)) continue;
        seen.add(dep.file);
        visit(dep);
        if (pattern.test(dep.file) && dep.file !== file.replaceAll('\\', '/')) order.push(dep.file);
      }
    };
    nodesOf(file).forEach(visit);
    return order;
  }

  // Every module matching `pattern` whose description depends on `file` (itself included when it matches).
  function affectedBy(file, pattern) {
    const found = new Set();
    const seen = new Set();
    const visit = (node) => {
      if (seen.has(node)) return;
      seen.add(node);
      if (node.file && pattern.test(node.file)) found.add(node.file);
      node.importers.forEach(visit);
    };
    nodesOf(file).forEach(visit);
    if (pattern.test(file)) found.add(file.replaceAll('\\', '/'));
    return [...found];
  }

  // A changed file is evaluated again from its source.
  function invalidate(file) {
    const env = environment();
    for (const node of nodesOf(file)) env.moduleGraph.invalidateModule(node);
    env.runner.clearCache();
  }

  return { dependencies, affectedBy, invalidate };
}
