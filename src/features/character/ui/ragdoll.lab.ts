import { defineLab } from '../../../shared/lib/devLab';

export default defineLab({
  id: 'ragdoll',
  title: 'Ragdoll',
  description: 'The ragdoll an import builds for a character (VgeRagdoll.cpp): the Mixamo mannequin dropped with a push, with each fall measured.',
  category: 'character',
  load: () => import('../labs/ragdoll'),
});
