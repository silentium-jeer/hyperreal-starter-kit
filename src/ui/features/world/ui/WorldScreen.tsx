import type { ComponentType } from 'react'

import { useReportInitialRenderReady } from '../../bootstrap'
import { GameWorld } from './GameWorld'

export function worldScreen(scene: string, title: string): ComponentType {
  return function WorldScreen() {
    useReportInitialRenderReady()
    return <GameWorld scene={scene} title={title} />
  }
}
