type InitialRenderRequest = {
  promise: Promise<void>
  requestId: number
}

let currentRequestId = 0
let resolvedRequestId = 0
let resolveCurrentRequest: (() => void) | null = null

export function requestInitialRenderReady(): InitialRenderRequest {
  currentRequestId += 1

  const promise = new Promise<void>((resolve) => {
    resolveCurrentRequest = resolve
  })

  return {
    promise,
    requestId: currentRequestId,
  }
}

export function reportInitialRenderReady(requestId: number): void {
  if (requestId !== currentRequestId || requestId === resolvedRequestId) {
    return
  }

  resolvedRequestId = requestId
  resolveCurrentRequest?.()
}

export function resetInitialRenderReadyForTests(): void {
  currentRequestId = 0
  resolvedRequestId = 0
  resolveCurrentRequest = null
}
