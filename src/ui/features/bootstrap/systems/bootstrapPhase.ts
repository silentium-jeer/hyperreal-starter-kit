export type BootstrapPhase =
  | 'prepare'
  | 'assets'
  | 'finalize'
  | 'render'
  | 'ready'
  | 'failed'

export function shouldMountAppForBootstrapPhase(phase: BootstrapPhase): boolean {
  return phase === 'render' || phase === 'ready'
}
