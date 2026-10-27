export type BootstrapStep = {
  readonly id: string
  run(signal: AbortSignal): Promise<void>
}
