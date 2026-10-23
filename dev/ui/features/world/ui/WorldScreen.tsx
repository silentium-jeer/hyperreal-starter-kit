import type { ComponentType } from 'react'

import { useReportInitialRenderReady } from '../../bootstrap'
import { GameWorld } from './GameWorld'

// A screen that is one scene: its world over the whole screen. The app's navigation and the scene's name are in
// the shell window's title bar (dev/ui/shell), not over the world.
export function worldScreen(scene: string, title: string): ComponentType {
  return function WorldScreen() {
    useReportInitialRenderReady()
    return <GameWorld scene={scene} title={title} />
  }
}
