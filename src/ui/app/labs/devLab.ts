import type { DevLabCategory } from '../../shared/lib/devLab'

export const DEV_LAB_CATEGORIES: readonly { readonly id: DevLabCategory; readonly title: string }[] = [
  { id: 'character', title: 'Character & rig' },
  { id: 'combat', title: 'Combat' },
  { id: 'ai', title: 'AI & navigation' },
  { id: 'gear', title: 'Gear & survival' },
  { id: 'world', title: 'World' },
  { id: 'render', title: 'Rendering & VFX' },
  { id: 'meta', title: 'Meta loop' },
]
