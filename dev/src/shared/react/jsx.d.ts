import type { UeIntrinsicElements } from '../../../../Typing/ue/ue-jsx';
import type { MaterialIntrinsicElements } from '../../../../Typing/ue/ue-material-jsx';
import type { AnimIntrinsicElements } from './anim';

// Every engine actor and component class as a JSX element, from the generated map (VgeGenTypings), the animation
// graph elements (anim.ts), and the material expression elements of material modules (shared/material, generated
// as well: ue-material-jsx.d.ts).
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements extends UeIntrinsicElements, AnimIntrinsicElements, MaterialIntrinsicElements {}
  }
}
