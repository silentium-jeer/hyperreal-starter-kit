import { defineLab } from '../../../shared/lib/devLab';

export default defineLab({
  id: 'playground',
  title: 'Playground',
  description: 'Unreal\'s stock Mannequin as a player character (WASD, Space) among physics boxes.',
  category: 'character',
  load: () => import('../labs/playground'),
});
