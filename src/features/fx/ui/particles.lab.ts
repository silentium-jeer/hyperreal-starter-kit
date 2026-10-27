import { defineLab } from '../../../shared/lib/devLab';

export default defineLab({
  id: 'particles',
  title: 'Particles',
  description: 'Niagara systems written in TypeScript (features/fx/assets/effects.niagara.ts): GPU sparks with user parameters, a burst, a ribbon and mesh particles; save the module and they rebuild live.',
  category: 'render',
  load: () => import('../labs/particles'),
});
