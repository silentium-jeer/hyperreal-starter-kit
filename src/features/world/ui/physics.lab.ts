import { defineLab } from '../../../shared/lib/devLab';

export default defineLab({
  id: 'physics',
  title: 'Physics',
  description: 'Chaos rigid bodies declared in React: a row of dominoes pushed once, a box pyramid, and spheres added and removed as a list.',
  category: 'world',
  load: () => import('../labs/physics'),
});
