import { ask, inShell } from './bridge'

// The Fab window on request of the dev server (POST /__vge/fab/open, from `node tools/fab.mjs open`): the shell
// opens it on that Fab page (shell/src FabWindow), or loads the page in it when it is open already.
export function listenForFab() {
  if (!import.meta.hot || !inShell()) return
  import.meta.hot.on('vge:fab-open', ({ url }: { url?: string }) => {
    ask({ cmd: 'fab.open', ...(url ? { url } : {}) }).catch((error: Error) => console.error(`[fab] ${error.message}`))
  })
}
