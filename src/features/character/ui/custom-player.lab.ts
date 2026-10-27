import { defineLab } from '../../../shared/lib/devLab';

export default defineLab({
  id: 'custom-player',
  title: 'Your character as the player',
  description: "Manny swapped for a character of your own: the Mixamo mannequin as the player, with the same controls and locomotion graph, playing Manny's unarmed set retargeted onto it by one import line (?retargetFrom=manny). Switch between the two.",
  category: 'character',
  load: () => import('../labs/custom-player'),
});
