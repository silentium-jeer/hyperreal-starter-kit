import type { DevLab, DevLabCategory } from '../../shared/lib/devLab'
import { worldScreen } from '../../features/world'
import type { DevLab as GameLab } from '../../../src/shared/lib/devLab'
import { DEV_LAB_CATEGORIES } from './devLab'

/**
 * The DEV lab registry — the ONE list of labs (`dev-lab-authoring`, rule 3).
 *
 * Labs are discovered by globbing their manifests, never from a hand-maintained
 * array: a list someone has to remember to edit is a list that goes stale, and
 * the failure is silent — a lab exists with no route, or a route points at a lab
 * nobody can find.
 *
 * This module is only ever reached through the router's dynamic import of the
 * DEV lab subtree, which is what keeps every lab — and every preview image they
 * carry — out of the production bundle and out of the bootstrap preloader.
 */
//
// Here the labs are the game's (dev/src/features/<slice>/ui/<id>.lab.ts, read by the game too, app/scenes.ts).
// Their scenes run in the engine, so a lab's screen in this page is its world: the game process the shell starts
// for that scene while the screen is open (features/world GameWorld). The game's loader is never called here.
const gameLabModules = import.meta.glob<{ default: GameLab }>('../../../src/features/*/ui/*.lab.ts', { eager: true })
const labModules = Object.fromEntries(
  Object.entries(gameLabModules).map(([path, module]) => {
    const { load: _gameLoad, ...lab } = module.default
    const devLab: DevLab = { ...lab, load: async () => ({ default: worldScreen(`labs/${lab.id}`, lab.title) }) }
    return [path, { devLab }]
  }),
)

/**
 * Captured preview frames, matched to labs by filename (`<lab id>.png`).
 *
 * Attached here rather than imported by each manifest so that capturing a
 * preview is not also a source edit: `npm run labs:previews` drops the file in
 * and the card fills itself. A lab may still name its own `preview` to override.
 */
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
      // Two labs on one id means one of them is unreachable, and which one wins
      // depends on glob order. Say so rather than let it be found later.
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

/** The index's groups, in the declared order, with empty categories dropped. */
export function groupDevLabs(labs: readonly DevLab[] = DEV_LABS): readonly DevLabGroup[] {
  return DEV_LAB_CATEGORIES.map((category) => ({
    category: category.id,
    labs: labs.filter((lab) => lab.category === category.id),
    title: category.title,
  })).filter((group) => group.labs.length > 0)
}
