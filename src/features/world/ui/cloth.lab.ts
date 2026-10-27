import { defineLab } from '../../../shared/lib/devLab';

export default defineLab({
  id: 'cloth',
  title: 'Cloth',
  description: 'Chaos Cloth made at import from a model and its .cloth.json: a flag in gusting wind and a curtain a ball pushes through, with wind and fabric changed live.',
  category: 'world',
  load: () => import('../labs/cloth'),
});
