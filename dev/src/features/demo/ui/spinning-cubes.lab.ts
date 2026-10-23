import { defineLab } from '../../../shared/lib/devLab';

export default defineLab({
  id: 'spinning-cubes',
  title: 'Spinning cubes',
  description: 'Five cubes on the lab stage, driven by a script timer.',
  category: 'world',
  load: () => import('../labs/spinning-cubes'),
});
