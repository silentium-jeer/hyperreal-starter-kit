import type { UeIntrinsicElements } from '../../../../Typing/ue/ue-jsx';

// Every engine actor and component class as a JSX element, from the generated map (VgeGenTypings).
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements extends UeIntrinsicElements {}
  }
}
