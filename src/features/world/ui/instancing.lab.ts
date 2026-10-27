import { defineLab } from '../../../shared/lib/devLab';

export default defineLab({
  id: 'instancing',
  title: 'Instancing',
  description: '1600 static mesh elements packed into one instanced component per material, the way a Packed Level Actor packs a level.',
  category: 'render',
  load: () => import('../labs/instancing'),
});
