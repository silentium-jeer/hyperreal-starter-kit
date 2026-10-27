import { readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';

const BOM = String.fromCharCode(0xfeff);

export function readSource(path) {
  const raw = readFileSync(path, 'utf8');
  const bom = raw.startsWith(BOM);
  return { text: bom ? raw.slice(1) : raw, bom };
}

export function writeIfUnchanged(path, expected, next) {
  const current = readSource(path);
  if (current.text !== expected) throw new Error(`${path} changed on disk since it was read; nothing was written`);
  const temporary = `${path}.vge-edit-${process.pid}`;
  writeFileSync(temporary, (current.bom ? BOM : '') + next, 'utf8');
  if (readSource(path).text !== expected) {
    unlinkSync(temporary);
    throw new Error(`${path} changed on disk while it was being written; nothing was written`);
  }
  renameSync(temporary, path);
}

export function createHistory() {
  const byClient = new WeakMap();
  const stacksOf = (client) => {
    let stacks = byClient.get(client);
    if (!stacks) byClient.set(client, (stacks = { done: [], undone: [] }));
    return stacks;
  };
  const replay = (files, from, to) => {
    for (const file of files) {
      if (readSource(file.path).text !== file[from]) throw new Error(`${file.path} changed since the edit; nothing was written`);
    }
    for (const file of files) writeIfUnchanged(file.path, file[from], file[to]);
    return files.map(({ path }) => path);
  };
  return {
    record(client, files) {
      const stacks = stacksOf(client);
      stacks.done.push(files);
      stacks.undone.length = 0;
    },
    undo(client) {
      const stacks = stacksOf(client);
      const files = stacks.done.at(-1);
      if (!files) throw new Error('nothing to undo');
      const paths = replay(files, 'after', 'before');
      stacks.undone.push(stacks.done.pop());
      return paths;
    },
    redo(client) {
      const stacks = stacksOf(client);
      const files = stacks.undone.at(-1);
      if (!files) throw new Error('nothing to redo');
      const paths = replay(files, 'before', 'after');
      stacks.done.push(stacks.undone.pop());
      return paths;
    },
  };
}
