type Reply = { id: string; ok: boolean; result?: any; error?: string };

const pending = new Map<string, (reply: Reply) => void>();
let lastId = 0;

import.meta.hot?.on('vge:edit-reply', (reply: Reply) => {
  pending.get(reply.id)?.(reply);
  pending.delete(reply.id);
});

export function requestEdit<T>(op: string, payload: Record<string, unknown> = {}): Promise<T> {
  const id = `edit-${++lastId}`;
  return new Promise<T>((resolve, reject) => {
    pending.set(id, (reply) => (reply.ok ? resolve(reply.result as T) : reject(new Error(reply.error))));
    import.meta.hot?.send('vge:edit', { id, op, ...payload });
  });
}
