import { ApiError } from '../api'

export const OFFLINE_MESSAGE = 'Could not reach the server. Is app.py running?'

// abort error
export const isAbort = (err: unknown): boolean =>
  err instanceof Error && err.name === 'AbortError'

// api error
export const errorText = (err: unknown): string =>
  err instanceof ApiError ? err.message : OFFLINE_MESSAGE
