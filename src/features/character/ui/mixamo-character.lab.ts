import { defineLab } from '../../../shared/lib/devLab';

export default defineLab({
  id: 'mixamo-character',
  title: 'Mixamo character',
  description: 'Your own character from Mixamo: the standard Mixamo mannequin (With Skin FBX) and animation-only Mixamo clips imported onto its skeleton with one import line each; pick a clip.',
  category: 'character',
  load: () => import('../labs/mixamo-character'),
});
