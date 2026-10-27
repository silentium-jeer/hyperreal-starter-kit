import { defineLab } from '../../../shared/lib/devLab';

export default defineLab({
  id: 'fixed-step',
  title: 'Fixed step',
  description: 'Three cubes on the same 30 Hz rules: fixed steps from the frame drawn interpolated, the same steps drawn raw, and steps from a script timer.',
  category: 'world',
  load: () => import('../labs/fixed-step'),
});
