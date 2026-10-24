import type { UeIntrinsicElements } from '../../../../Typing/ue/ue-jsx';
import type { AnimIntrinsicElements } from './anim';

// Every engine actor and component class as a JSX element, from the generated map (VgeGenTypings), and the
// animation graph elements (anim.ts).
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements extends UeIntrinsicElements, AnimIntrinsicElements {}
  }
}
