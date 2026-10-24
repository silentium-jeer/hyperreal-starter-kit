import { useEffect, useState } from 'react'

import styles from './FabNotices.module.css'

// What the user hears about an asset added from the Fab window (shell/src FabWindow closes once Add to Project is
// pressed): one notice per install, over every screen of the shell, following the dev server's events
// (dev/content/fab.mjs notify -> vge:fab-install). Downloading, then cooking or importing, then where the asset is
// in the project, or why it failed.
interface FabInstall {
  id: string
  name: string
  state: 'started' | 'done' | 'failed'
  progress?: { stage: string; percent?: number }
  result?: { kind: 'pack' | 'model' | 'plugin'; contentPath?: string; key?: string; plugin?: string; objects?: { path: string; class: string }[] }
  error?: string
}

// A finished install's notice stays this long; a failed one until it is closed.
const DONE_MS = 20000

function where(install: FabInstall): string {
  const result = install.result
  if (!result) return ''
  if (result.kind === 'pack') return `in the project at ${result.contentPath}`
  if (result.kind === 'model') {
    const mesh = result.objects?.find((each) => each.class === 'StaticMesh' || each.class === 'SkeletalMesh')
    return `in the project: ${result.key}${mesh ? `, ${mesh.path}` : ''}`
  }
  return `plugin ${result.plugin} installed, the runtime was rebuilt: restart the dev server`
}

function status(install: FabInstall): string {
  if (install.state === 'done') return `Added ${where(install)}`
  if (install.state === 'failed') return `Failed: ${install.error}`
  const stage = install.progress?.stage ?? 'starting'
  const percent = install.progress?.percent
  return `${stage[0].toUpperCase()}${stage.slice(1)}${percent !== undefined ? ` ${Math.floor(percent)}%` : '…'}`
}

export function FabNotices() {
  const [installs, setInstalls] = useState<Record<string, FabInstall>>({})

  useEffect(() => {
    if (!import.meta.hot) return undefined
    const timers = new Map<string, number>()
    const dismiss = (id: string) => setInstalls(({ [id]: _, ...rest }) => rest)
    const onInstall = (install: FabInstall) => {
      setInstalls((all) => ({ ...all, [install.id]: install }))
      if (install.state === 'done') timers.set(install.id, window.setTimeout(() => dismiss(install.id), DONE_MS))
    }
    import.meta.hot.on('vge:fab-install', onInstall)
    return () => {
      import.meta.hot?.off('vge:fab-install', onInstall)
      timers.forEach((timer) => window.clearTimeout(timer))
    }
  }, [])

  const list = Object.values(installs)
  if (!list.length) return null
  return (
    <section aria-label="Fab" aria-live="polite" className={styles.notices} data-testid="fab-notices">
      {list.map((install) => (
        <article className={styles.notice} data-state={install.state} data-testid={`fab-notice-${install.id}`} key={install.id}>
          <header className={styles.head}>
            <span className={styles.name}>{install.name}</span>
            <button
              aria-label="Close"
              className={styles.close}
              data-testid={`fab-notice-close-${install.id}`}
              onClick={() => setInstalls(({ [install.id]: _, ...rest }) => rest)}
              type="button"
            >
              ×
            </button>
          </header>
          <p className={styles.status} data-testid={`fab-notice-status-${install.id}`}>
            {status(install)}
          </p>
          {install.state === 'started' && install.progress?.percent !== undefined && (
            <div className={styles.track}>
              <div className={styles.bar} style={{ width: `${Math.min(100, install.progress.percent)}%` }} />
            </div>
          )}
        </article>
      ))}
    </section>
  )
}
