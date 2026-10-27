import { defineLab } from '../../../shared/lib/devLab';

export default defineLab({
  id: 'sound',
  title: 'Sound',
  description: 'Sound files imported like models (features/fx/assets/sounds): a speaker circling the stage ticks in 3D, effects play in 2D, and a long pad plays as music.',
  category: 'render',
  load: () => import('../labs/sound'),
});
