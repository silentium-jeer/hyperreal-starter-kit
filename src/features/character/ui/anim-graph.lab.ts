import { defineLab } from '../../../shared/lib/devLab';

export default defineLab({
  id: 'anim-graph',
  title: 'Animation graph',
  description: 'Animation graphs written as JSX (<animGraph>): a mannequin whose graph changes shape between clips, blends and a state machine, and a character whose graph comes and goes.',
  category: 'character',
  load: () => import('../labs/anim-graph'),
});
