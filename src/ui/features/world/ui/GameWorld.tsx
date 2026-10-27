import { useEffect, useRef, useState } from 'react'

import { ask, follow } from '../../../shell/bridge'
import styles from './GameWorld.module.css'

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
    document.documentElement.classList.add(styles.worldOpen)
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
