import { defineLab } from '../../../shared/lib/devLab';

export default defineLab({
  id: 'lumen',
  title: 'Lumen',
  description: 'A closed room lit by the sun through a ceiling hole and a glowing panel: Lumen bounce light, colour bleeding from the red and green walls, reflections on the floor and the metal.',
  category: 'render',
  load: () => import('../labs/lumen'),
});
