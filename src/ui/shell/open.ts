import { inShell } from './bridge'

export function listenForOpen() {
  if (!import.meta.hot || !inShell()) return
  import.meta.hot.on('vge:shell-open', ({ path }: { path: string }) => {
    if (window.location.pathname === path) return
    window.history.pushState(null, '', path)
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
}
