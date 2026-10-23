// A lab is an isolated scene for one asset, system or mechanic. Its manifest lives in
// features/<slice>/ui/<lab-id>.lab.ts and exports nothing else; the body lives in
// features/<slice>/labs/<lab-id>/ and is loaded only when the lab opens (in its own process with
// -Scene=labs/<lab-id>, or from the scene picker of a running game).
export type DevLabCategory = 'ai' | 'character' | 'combat' | 'gear' | 'meta' | 'render' | 'world';

import type { ComponentType } from 'react';

// A scene is declared as a React component (`Scene`), rendered by the scene renderer (shared/react), or built
// imperatively (`default`): everything spawned or hooked up through shared/engine/world belongs to the scene.
// Either way it is removed when another scene opens.
export type SceneModule = { Scene: ComponentType; default?: never } | { default: () => void | Promise<void>; Scene?: never };

export interface DevLab {
  id: string;
  title: string;
  description: string;
  category: DevLabCategory;
  load: () => Promise<SceneModule>;
}

export const defineLab = (lab: DevLab) => lab;
