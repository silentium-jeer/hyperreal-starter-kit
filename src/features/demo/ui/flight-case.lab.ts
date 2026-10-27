import { defineLab } from '../../../shared/lib/devLab';

export default defineLab({
  id: 'flight-case',
  title: 'Flight case',
  description: 'features/demo/assets/flight-case.glb on a turntable; saving the .glb swaps the mesh live.',
  category: 'gear',
  load: () => import('../labs/flight-case'),
});
