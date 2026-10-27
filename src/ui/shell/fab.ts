import { ask, inShell } from './bridge'

export function listenForFab() {
  if (!import.meta.hot || !inShell()) return
  import.meta.hot.on('vge:fab-open', ({ url }: { url?: string }) => {
    ask({ cmd: 'fab.open', ...(url ? { url } : {}) }).catch((error: Error) => console.error(`[fab] ${error.message}`))
  })
}
