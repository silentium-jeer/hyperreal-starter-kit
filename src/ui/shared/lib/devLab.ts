import type { ComponentType } from 'react'

export interface DevLab {
  readonly category: DevLabCategory
  readonly description: string
  readonly id: string
  readonly load: () => Promise<{ readonly default: ComponentType }>
  readonly preview?: string
  readonly title: string
}

export type DevLabCategory =
  | 'ai'
  | 'character'
  | 'combat'
  | 'gear'
  | 'meta'
  | 'render'
  | 'world'

export interface DevLabModule {
  readonly devLab: DevLab
}
