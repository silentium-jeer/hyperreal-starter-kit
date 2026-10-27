type CefQuery = (query: {
  request: string
  persistent?: boolean
  onSuccess: (response: string) => void
  onFailure: (code: number, message: string) => void
}) => number

declare global {
  interface Window {
    cefQuery?: CefQuery
    cefQueryCancel?: (id: number) => void
  }
}

const NO_SHELL = 'no shell: open this page in the Hyperreal Starter Kit shell (npm run shell)'

export const inShell = () => Boolean(window.cefQuery)

export function ask(command: Record<string, unknown>): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    if (!window.cefQuery) {
      reject(new Error(NO_SHELL))
      return
    }
    window.cefQuery({
      request: JSON.stringify(command),
      onSuccess: (response) => resolve(JSON.parse(response) as Record<string, unknown>),
      onFailure: (code, message) => reject(new Error(`${message} (${code})`)),
    })
  })
}

export function follow(command: Record<string, unknown>, onAnswer: (answer: Record<string, unknown>) => void, onError: (error: Error) => void): () => void {
  if (!window.cefQuery) {
    onError(new Error(NO_SHELL))
    return () => {}
  }
  const id = window.cefQuery({
    request: JSON.stringify(command),
    persistent: true,
    onSuccess: (response) => onAnswer(JSON.parse(response) as Record<string, unknown>),
    onFailure: (code, message) => onError(new Error(`${message} (${code})`)),
  })
  return () => window.cefQueryCancel?.(id)
}
