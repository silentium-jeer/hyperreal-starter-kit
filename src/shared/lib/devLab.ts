export type DevLabCategory = 'ai' | 'character' | 'combat' | 'gear' | 'meta' | 'render' | 'world';

import type { ComponentType } from 'react';

export type SceneModule = { Scene: ComponentType; default?: never } | { default: () => void | Promise<void>; Scene?: never };

export interface DevLab {
  id: string;
  title: string;
  description: string;
  category: DevLabCategory;
  load: () => Promise<SceneModule>;
}

export const defineLab = (lab: DevLab) => lab;
