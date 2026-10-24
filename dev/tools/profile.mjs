// Profiles: a second checkout of this kit (a git worktree on its own branch) with its own ports, its own processes and
// its own link to the runtime for its sources, so an agent builds and tests a feature without stopping the main kit
// or other profiles. Runtimes stay in the machine's shared store: a profile whose C++ sources match a built runtime
// links to it at once, one with changed sources builds its own beside the others.
//   npm run profile -- create <name>   ../<kit>.<name> on branch profile/<name>, then its setup
//   npm run profile -- list
//   npm run profile -- remove <name>   stops its processes and removes the checkout; the branch stays
// Back into the main kit: merge profile/<name> there and run `npm run build:cpp`. When nothing else changed in the
// main kit meanwhile, the merged sources are the profile's and their runtime is already built; otherwise the new
// runtime builds beside the running one and the main kit's dev server is restarted at the end.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, rmdirSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { repoRoot } from './engine.mjs';
import { isAlive } from './processes.mjs';
import { LINKS } from './runtime.mjs';

const [command, name] = process.argv.slice(2);
const git = (...args) => execFileSync('git', ['-C', repoRoot, ...args], { encoding: 'utf8' }).trim();
const configOf = (dir) => (existsSync(join(dir, 'vge.config.json')) ? JSON.parse(readFileSync(join(dir, 'vge.config.json'), 'utf8')) : {});
const isLink = (path) => lstatSync(path, { throwIfNoEntry: false })?.isSymbolicLink() ?? false;
const NODE_MODULES = ['node_modules', 'dev/node_modules'];

// The main checkout first, then the profiles.
function checkouts() {
  const list = [];
  for (const block of git('worktree', 'list', '--porcelain').split(/\n\n/)) {
    const dir = block.match(/^worktree (.+)$/m)?.[1];
    if (!dir) continue;
    const branch = block.match(/^branch refs\/heads\/(.+)$/m)?.[1] ?? '(detached)';
    list.push({ dir: resolve(dir), branch, profile: branch.startsWith('profile/') ? branch.slice('profile/'.length) : null });
  }
  return list;
}

const mainCheckout = () => checkouts()[0].dir;
const profileDir = (profile) => join(dirname(mainCheckout()), `${basename(mainCheckout())}.${profile}`);

// Profile n gets the main kit's ports + 10 n.
function freePorts() {
  const used = new Set(checkouts().map(({ dir }) => configOf(dir).ports?.dev ?? 5173));
  let n = 1;
  while (used.has(5173 + 10 * n)) n += 1;
  return { dev: 5173 + 10 * n, hud: 9222 + 10 * n, shell: 9221 + 10 * n };
}

function create() {
  const dir = profileDir(name);
  if (existsSync(dir)) throw new Error(`${dir} exists already`);
  git('worktree', 'add', '-b', `profile/${name}`, dir, 'HEAD');
  const ports = freePorts();
  writeFileSync(join(dir, 'vge.config.json'), `${JSON.stringify({ engine: configOf(mainCheckout()).engine, ports }, null, 2)}\n`);
  // Dependencies are the main checkout's; a profile that changes package.json runs npm install in its own dev/.
  for (const path of NODE_MODULES) {
    if (existsSync(join(mainCheckout(), path))) symlinkSync(join(mainCheckout(), path), join(dir, path), 'junction');
  }
  console.log(`[profile] ${name}: ${dir} on profile/${name}, dev server ${ports.dev}, HUD DevTools ${ports.hud}, shell DevTools ${ports.shell}`);
  console.log('[profile] it starts from the last commit; uncommitted changes of the main checkout are not in it');
  const setup = spawnSync(process.execPath, ['tools/setup.mjs'], { cwd: join(dir, 'dev'), stdio: 'inherit' });
  if (setup.status !== 0) process.exit(setup.status ?? 1);
}

function list() {
  for (const { dir, branch, profile } of checkouts()) {
    const { ports = { dev: 5173 }, runtime } = configOf(dir);
    const processesFile = join(dir, 'Saved', 'processes.json');
    const running = existsSync(processesFile) ? JSON.parse(readFileSync(processesFile, 'utf8')).filter((entry) => isAlive(entry.pid)) : [];
    console.log(`${profile ?? '(main)'}  ${dir}  ${branch}  dev ${ports.dev}  runtime ${runtime ? basename(runtime) : '-'}  running: ${running.map((entry) => entry.kind).join(', ') || 'nothing'}`);
  }
}

function remove() {
  const dir = profileDir(name);
  if (!checkouts().some((checkout) => checkout.dir === dir)) throw new Error(`no profile ${name} at ${dir}`);
  spawnSync(process.execPath, ['tools/stop.mjs'], { cwd: join(dir, 'dev'), stdio: 'inherit' });
  // The links point into the shared runtime and the main checkout's dependencies: they are removed as links first,
  // so removing the checkout cannot reach what they point at.
  for (const path of [...LINKS, ...NODE_MODULES]) {
    const link = join(dir, path);
    if (!isLink(link)) continue;
    try {
      unlinkSync(link);
    } catch {
      rmdirSync(link);
    }
  }
  git('worktree', 'remove', '--force', dir);
  console.log(`[profile] removed ${dir}; branch profile/${name} kept`);
}

const commands = { create, list, remove };
if (!commands[command] || (command !== 'list' && !/^[a-z0-9-]+$/.test(name ?? ''))) {
  console.error('usage: npm run profile -- create <name> | list | remove <name>   (name: a-z, 0-9, -)');
  process.exit(1);
}
commands[command]();
