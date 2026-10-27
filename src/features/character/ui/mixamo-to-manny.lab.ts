import { defineLab } from '../../../shared/lib/devLab';

export default defineLab({
  id: 'mixamo-to-manny',
  title: 'Mixamo clips on Manny',
  description: "Mixamo clips retargeted onto Unreal's Manny by their import line (&retarget=manny): IK Rigs and a retargeter generated the way the editor's Retarget Animations window does. The Mixamo mannequin plays each clip beside him.",
  category: 'character',
  load: () => import('../labs/mixamo-to-manny'),
});
