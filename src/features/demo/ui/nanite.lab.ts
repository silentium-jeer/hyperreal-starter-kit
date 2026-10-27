import { defineLab } from '../../../shared/lib/devLab';

export default defineLab({
  id: 'nanite',
  title: 'Nanite',
  description: '10,000 copies of the Nanite mesh imported from features/demo/assets/flight-case.glb, packed into one instanced component; save the .glb and every copy changes.',
  category: 'render',
  load: () => import('../labs/nanite'),
});
