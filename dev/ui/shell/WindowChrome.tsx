import { useEffect, useState } from 'react'

import { DEV_LABS } from '../app/labs/labRegistry'
import { ask, inShell } from './bridge'
import styles from './WindowChrome.module.css'

// The frameless shell window's title bar, above the app (shell.css): the app's navigation (the main scene, the
// lab index, the UI kit) and the name of what is open, the window's minimize / maximize / close buttons, and the
// rest of it moves the window (CSS app-region: drag, which the shell reads as its caption; a double click
// maximizes). Resizing is the shell's, from the window's edges.
//
// The bar is a root of its own beside the app's router (the web-starter-kit's, unchanged): it navigates the way
// the browser's own back and forward do (a history entry, then popstate, which the router follows) and hears the
// app's own navigations through the Navigation API.
type Section = 'main' | 'labs' | 'ui-kit'

const SECTIONS: readonly { id: Section; label: string; path: string }[] = [
  { id: 'main', label: 'Main scene', path: '/' },
  { id: 'labs', label: 'Labs', path: '/labs' },
  { id: 'ui-kit', label: 'UI kit', path: '/ui-kit' },
]

function sectionOf(path: string): Section {
  if (path.startsWith('/labs')) return 'labs'
  if (path.startsWith('/ui-kit')) return 'ui-kit'
  return 'main'
}

function titleOf(path: string): string {
  const lab = /^\/labs\/([^/]+)/.exec(path)?.[1]
  if (lab) return DEV_LABS.find((each) => each.id === lab)?.title ?? lab
  if (path.startsWith('/labs')) return 'Labs'
  if (path.startsWith('/ui-kit')) return 'UI kit'
  return 'Main scene'
}

function go(path: string) {
  if (window.location.pathname === path) return
  window.history.pushState(null, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function usePath() {
  const [path, setPath] = useState(window.location.pathname)
  useEffect(() => {
    const update = () => setPath(window.location.pathname)
    // The Navigation API is Chromium's (the shell's CEF); a browser without it still follows back/forward.
    const navigation = 'navigation' in window ? window.navigation : undefined
    window.addEventListener('popstate', update)
    navigation?.addEventListener('currententrychange', update)
    return () => {
      window.removeEventListener('popstate', update)
      navigation?.removeEventListener('currententrychange', update)
    }
  }, [])
  return path
}

export function WindowChrome() {
  const path = usePath()
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    if (!inShell()) return undefined
    const refresh = () => void ask({ cmd: 'window.state' }).then((state) => setMaximized(Boolean(state.maximized)))
    refresh()
    window.addEventListener('resize', refresh)
    return () => window.removeEventListener('resize', refresh)
  }, [])

  const section = sectionOf(path)
  return (
    <header className={styles.bar} data-testid="window-title-bar" onDoubleClick={() => void ask({ cmd: 'window.maximize' })}>
      <nav aria-label="App" className={styles.sections} onDoubleClick={(event) => event.stopPropagation()}>
        {SECTIONS.map((each) => (
          <button
            aria-current={section === each.id ? 'page' : undefined}
            className={styles.section}
            data-testid={`nav-${each.id}`}
            key={each.id}
            onClick={() => go(each.path)}
            type="button"
          >
            {each.label}
          </button>
        ))}
      </nav>
      <span className={styles.title} data-testid="window-title">
        {titleOf(path)}
      </span>
      <div className={styles.controls} role="toolbar" aria-label="Window" onDoubleClick={(event) => event.stopPropagation()}>
        <button aria-label="Minimize" className={styles.button} data-testid="window-minimize" onClick={() => void ask({ cmd: 'window.minimize' })} type="button">
          <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6h7" /></svg>
        </button>
        <button
          aria-label={maximized ? 'Restore' : 'Maximize'}
          className={styles.button}
          data-testid="window-maximize"
          onClick={() => void ask({ cmd: 'window.maximize' }).then((state) => setMaximized(Boolean(state.maximized)))}
          type="button"
        >
          {maximized ? (
            <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M4 2.5h5.5V8M2.5 4h5.5v5.5H2.5z" /></svg>
          ) : (
            <svg viewBox="0 0 12 12" aria-hidden="true"><rect x="2.5" y="2.5" width="7" height="7" rx="1.5" /></svg>
          )}
        </button>
        <button aria-label="Close" className={`${styles.button} ${styles.close}`} data-testid="window-close" onClick={() => void ask({ cmd: 'window.close' })} type="button">
          <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 3l6 6M9 3l-6 6" /></svg>
        </button>
      </div>
    </header>
  )
}
