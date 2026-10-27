import { performance } from 'node:perf_hooks';
import { SourceMapConsumer } from 'source-map-js';

const AsyncFunction = async function () {}.constructor;
const FUNCTION_HEADER_LINES = new AsyncFunction('a', 'b', '/*code*/').toString().split('/*code*/')[0].split('\n').length - 1;
const USE_STRICT_LINE = 1;
const RUNNER_LINE_OFFSET = FUNCTION_HEADER_LINES + USE_STRICT_LINE;
const FRAME = /\(?([^()\s]+):(\d+):(\d+)\)?$/;

export function sourceUrlPlugin({ root }) {
  const sourceRoot = `${root.replaceAll('\\', '/')}/src/`;
  return {
    name: 'vge:edit-source-url',
    enforce: 'post',
    applyToEnvironment: (environment) => environment.name === 'unreal',
    transform(code, id) {
      if (id.includes('?') || !id.startsWith(sourceRoot) || !/\.tsx$/.test(id)) return;
      return { code: `${code}\n//# sourceURL=${id}`, map: null };
    },
  };
}

function framesOf(stack) {
  return stack
    .split('\n')
    .map((line) => FRAME.exec(line.trim()))
    .filter(Boolean)
    .map(([, file, line, column]) => ({ file, line: Number(line), column: Number(column) }));
}

const isSceneSource = (file, sourceRoot) => file.startsWith(sourceRoot) && !file.includes('/node_modules/');

const executedTransformOf = (module) => module.transformResult ?? (typeof module.invalidationState === 'object' ? module.invalidationState : undefined);

function lineStartsOf(text) {
  const starts = [0];
  for (let index = 0; index < text.length; index++) if (text[index] === '\n') starts.push(index + 1);
  return starts;
}

export function createSourceLocator({ environment, root }) {
  const sourceRoot = `${root.replaceAll('\\', '/')}/src/`;
  const consumers = new WeakMap();
  const stats = { lookups: 0, totalMs: 0, lastMs: 0 };

  const consumerOf = (map) => {
    let consumer = consumers.get(map);
    if (!consumer) consumers.set(map, (consumer = new SourceMapConsumer(map)));
    return consumer;
  };

  function locate(stack) {
    const started = performance.now();
    try {
      const frame = framesOf(stack ?? '').find((candidate) => isSceneSource(candidate.file, sourceRoot));
      if (!frame) return { outsideSources: true };
      const where = `${frame.file}:${frame.line}:${frame.column}`;
      const module = environment().moduleGraph.getModuleById(frame.file);
      if (!module) return { reason: `${where}: the module graph has no such module` };
      const map = executedTransformOf(module)?.map;
      if (!map?.mappings) return { reason: `${where}: the module has no transform sourcemap` };
      const position = consumerOf(map).originalPositionFor({ line: frame.line - RUNNER_LINE_OFFSET, column: frame.column - 1 });
      if (position.line == null) return { reason: `${where}: the sourcemap has no original position there` };
      const text = map.sourcesContent?.[0];
      if (text == null) return { reason: `${where}: the sourcemap carries no source text` };
      const offset = lineStartsOf(text)[position.line - 1] + position.column;
      return { file: frame.file, line: position.line, column: position.column + 1, offset, text };
    } finally {
      stats.lastMs = performance.now() - started;
      stats.totalMs += stats.lastMs;
      stats.lookups += 1;
    }
  }

  function mapMemory() {
    let modules = 0;
    let bytes = 0;
    for (const module of environment().moduleGraph.idToModuleMap.values()) {
      const map = executedTransformOf(module)?.map;
      if (!map?.mappings) continue;
      modules += 1;
      bytes += map.mappings.length + (map.sourcesContent ?? []).reduce((sum, content) => sum + (content?.length ?? 0), 0);
    }
    return { modules, bytes };
  }

  return {
    locate,
    stats: () => ({ ...stats, averageMs: stats.lookups ? stats.totalMs / stats.lookups : 0, maps: mapMemory() }),
  };
}
