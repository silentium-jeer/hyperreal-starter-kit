import { useEffect, useRef, useState } from 'react'

import { ask, follow } from '../../../shell/bridge'
import styles from './GameWorld.module.css'

// A scene on screen: the game as it is - its own process with its own engine world, V8 and HUD - started by the
// Hyperreal Starter Kit shell (shell/src) for as long as this element is mounted, its window kept exactly under
// this element's box. Once the world is up the box is transparent, so the world shows through and takes the
// mouse, and anything the page draws over the box (buttons, panels) stays the page's. Until then, and after the
// world's process has ended, the box shows a backdrop instead of an empty hole. Several elements are several
// worlds.
type WorldState = 'starting' | 'ready' | 'exited' | 'failed'

const rectOf = (element: HTMLElement) => {
  const box = element.getBoundingClientRect()
  return [box.x, box.y, box.width, box.height]
}

export function GameWorld({ scene, title }: { readonly scene: string; readonly title: string }) {
  const box = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line no-restricted-syntax -- the world's lifecycle as the shell reports it; the backdrop shows it.
  const [state, setState] = useState<WorldState>('starting')
  // eslint-disable-next-line no-restricted-syntax -- a new attempt after the world ended: remounts the world.
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const element = box.current
    if (!element) return undefined
    setState('starting')
    let id: number | undefined
    let stopFollowing: (() => void) | undefined
    // The page under the world must let it show through: the app's own background is on the root element.
    document.documentElement.classList.add(styles.worldOpen)
    // Every frame, because the box moves without resizing too: a transform (the bootstrap gate's entrance
    // animation scales the app layer), scrolling, layout above it. Only a changed rectangle goes to the shell.
    // The world opens on the first frame the box has a size: a game window created empty keeps no size.
    let sent = ''
    let frame = requestAnimationFrame(function track() {
      const rect = rectOf(element)
      const key = rect.map(Math.round).join(',')
      if (!stopFollowing && rect[2] >= 1 && rect[3] >= 1) {
        sent = key
        stopFollowing = follow(
          { cmd: 'world.open', scene, rect },
          (answer) => {
            if (typeof answer.id === 'number') id = answer.id
            if (answer.state === 'ready' || answer.state === 'exited') setState(answer.state)
          },
          (error) => {
            console.error(`[world] ${scene}: ${error.message}`)
            setState('failed')
          },
        )
      } else if (id !== undefined && key !== sent) {
        sent = key
        void ask({ cmd: 'world.rect', id, rect })
      }
      frame = requestAnimationFrame(track)
    })
    return () => {
      cancelAnimationFrame(frame)
      document.documentElement.classList.remove(styles.worldOpen)
      if (id !== undefined) void ask({ cmd: 'world.close', id })
      stopFollowing?.()
    }
  }, [scene, attempt])

  return (
    <div className={styles.world} data-scene={scene} data-state={state} data-testid="game-world" ref={box}>
      <div aria-hidden={state === 'ready'} className={styles.backdrop} data-testid="world-backdrop">
        {state === 'starting' ? (
          <>
            <span className={styles.spinner} />
            <p className={styles.caption}>{title}</p>
          </>
        ) : null}
        {state === 'exited' || state === 'failed' ? (
          <>
            <p className={styles.caption}>{state === 'exited' ? `${title} has closed` : `${title} could not start`}</p>
            <button className={styles.reopen} data-testid="world-reopen" onClick={() => setAttempt((value) => value + 1)} type="button">
              Open again
            </button>
          </>
        ) : null}
      </div>
    </div>
  )
}
