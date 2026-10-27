import type { UeIntrinsicElements } from '../../../unreal/Typing/ue/ue-jsx';
import type { MaterialIntrinsicElements } from '../../../unreal/Typing/ue/ue-material-jsx';
import type { AnimIntrinsicElements } from './anim';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements extends UeIntrinsicElements, AnimIntrinsicElements, MaterialIntrinsicElements {}
  }
}
