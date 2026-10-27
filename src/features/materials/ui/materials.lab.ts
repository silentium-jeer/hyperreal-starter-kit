import { defineLab } from '../../../shared/lib/devLab';

export default defineLab({
  id: 'materials',
  title: 'Materials',
  description: 'Materials written as JSX (features/materials/assets/lava.material.tsx, a Custom HLSL graph with parameters): saving the module puts the new material on the meshes; a dynamic instance takes new parameter values at once; a saved instance shares the material\'s shaders.',
  category: 'render',
  load: () => import('../labs/materials'),
});
