import { defineLab } from '../../../shared/lib/devLab';

export default defineLab({
  id: 'mannequin',
  title: 'Mannequin',
  description: "Unreal's stock Mannequin cycling the Third Person template's unarmed clips, chosen by name from TypeScript.",
  category: 'character',
  load: () => import('../labs/mannequin'),
});
