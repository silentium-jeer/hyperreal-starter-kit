import * as UE from 'ue';
import * as puerts from 'puerts';
import { gameInstance, world } from '../shared/engine/world';

// DEV seam: the dev server forwards an expression (tools/game.mjs, POST /__vge/eval), this process
// evaluates it with UE, puerts, world and gameInstance in scope, and replies with the result as JSON.
// Agents read state as numbers here instead of guessing it from frames.
function describe(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined || typeof value !== 'object') return value;
  if (depth > 3) return String(value);
  if (Array.isArray(value)) return value.map((item) => describe(item, depth + 1));
  const object = value as Record<string, unknown>;
  if (typeof (object as any).ToString === 'function' && 'X' in object) return (object as any).ToString();
  if (typeof (object as any).GetName === 'function') return `${(object as any).GetClass?.().GetName?.() ?? 'Object'} ${(object as any).GetName()}`;
  return Object.fromEntries(Object.entries(object).map(([key, item]) => [key, describe(item, depth + 1)]));
}

export function mountDebugSeam() {
  import.meta.hot?.on('vge:eval', async ({ id, code }: { id: string; code: string }) => {
    let reply: { id: string; ok: boolean; result?: unknown; error?: string };
    try {
      const evaluate = new Function('UE', 'puerts', 'world', 'gameInstance', `return (async () => (${code}))();`);
      reply = { id, ok: true, result: describe(await evaluate(UE, puerts, world, gameInstance)) };
    } catch (err: any) {
      reply = { id, ok: false, error: String(err?.stack ?? err) };
    }
    import.meta.hot?.send('vge:eval-result', reply);
  });
}
