import * as UE from 'ue';
import * as puerts from 'puerts';
import { gameInstance, world } from '../shared/engine/world';

function describe(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined || typeof value !== 'object') return value;
  if (depth > 3) return String(value);
  if (Array.isArray(value)) return value.map((item) => describe(item, depth + 1));
  const object = value as Record<string, unknown>;
  if (typeof (object as any).ToString === 'function' && 'X' in object) return (object as any).ToString();
  if (typeof (object as any).GetName === 'function') return `${(object as any).GetClass?.().GetName?.() ?? 'Object'} ${(object as any).GetName()}`;
  return Object.fromEntries(Object.entries(object).map(([key, item]) => [key, describe(item, depth + 1)]));
}

declare const __vge: { app?: { scene?: string } };

function devToolsPort() {
  const value = puerts.$ref('');
  return UE.KismetSystemLibrary.ParseParamValue(UE.KismetSystemLibrary.GetCommandLine(), 'cefdebug=', value) ? Number(puerts.$unref(value)) : null;
}

async function answerEval({ id, code, scene }: { id: string; code: string; scene?: string }) {
  const here = { scene: __vge.app?.scene ?? null, cdp: devToolsPort() };
  let reply: { id: string; ok: boolean; scene: string | null; cdp: number | null; skipped?: boolean; result?: unknown; error?: string };
  if (scene !== undefined && scene !== here.scene) {
    import.meta.hot?.send('vge:eval-result', { id, ok: true, skipped: true, ...here });
    return;
  }
  try {
    const evaluate = new Function('UE', 'puerts', 'world', 'gameInstance', `return (async () => (${code}))();`);
    reply = { id, ok: true, ...here, result: describe(await evaluate(UE, puerts, world, gameInstance)) };
  } catch (err: any) {
    reply = { id, ok: false, ...here, error: String(err?.stack ?? err) };
  }
  import.meta.hot?.send('vge:eval-result', reply);
}

export function mountDebugSeam() {
  import.meta.hot?.on('vge:eval', (request: { id: string; code: string; scene?: string }) => {
    void answerEval(request);
  });
}
