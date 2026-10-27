import { defineLab } from '../../../shared/lib/devLab';

export default defineLab({
  id: 'sandstorm',
  title: 'Sandstorm',
  description: 'A Niagara Fluids 3D gas grid built from TypeScript: a wall of sand rolling over the ground, lit by the sun.',
  category: 'render',
  load: () => import('../labs/sandstorm'),
});
