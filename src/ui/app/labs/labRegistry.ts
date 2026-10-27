import type { DevLab, DevLabCategory } from '../../shared/lib/devLab'
import { worldScreen } from '../../features/world'
import type { DevLab as GameLab } from '../../../shared/lib/devLab'
import { DEV_LAB_CATEGORIES } from './devLab'

const gameLabModules = import.meta.glob<{ default: GameLab }>('../../../features/*/ui/*.lab.ts', { eager: true })
const labModules = Object.fromEntries(
  Object.entries(gameLabModules).map(([path, module]) => {
    const { load: _gameLoad, ...lab } = module.default
    const devLab: DevLab = { ...lab, load: async () => ({ default: worldScreen(`labs/${lab.id}`, lab.title) }) }
    return [path, { devLab }]
  }),
)

const previewModules = import.meta.glob<string>('../ui/labs/previews/*.webp', {
  eager: true,
  import: 'default',
  query: '?url',
})

const previewsById = new Map(
  Object.entries(previewModules).map(([path, url]) => [
    path.slice(path.lastIndexOf('/') + 1, -'.webp'.length),
    url,
  ]),
)

function collectLabs(): readonly DevLab[] {
  const byId = new Map<string, DevLab>()

  for (const [path, module] of Object.entries(labModules)) {
    const lab = module.devLab
    if (!lab) {
      console.warn(`[labs] ${path} has no \`devLab\` export and was skipped.`)
      continue
    }
    if (byId.has(lab.id)) {
      console.warn(`[labs] duplicate lab id "${lab.id}" — ${path} collides with an earlier manifest.`)
      continue
    }
    const preview = lab.preview ?? previewsById.get(lab.id)
    byId.set(lab.id, preview ? { ...lab, preview } : lab)
  }

  return [...byId.values()].sort((left, right) => left.title.localeCompare(right.title))
}

export const DEV_LABS = collectLabs()

export type DevLabGroup = {
  readonly category: DevLabCategory
  readonly labs: readonly DevLab[]
  readonly title: string
}

export function groupDevLabs(labs: readonly DevLab[] = DEV_LABS): readonly DevLabGroup[] {
  return DEV_LAB_CATEGORIES.map((category) => ({
    category: category.id,
    labs: labs.filter((lab) => lab.category === category.id),
    title: category.title,
  })).filter((group) => group.labs.length > 0)
}
