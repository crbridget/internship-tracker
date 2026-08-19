import { ApiError } from '../api'

export const OFFLINE_MESSAGE = 'Could not reach the server. Is app.py running?'

/** An aborted request is expected on unmount, not something to log. */
export const isAbort = (err: unknown): boolean =>
  err instanceof Error && err.name === 'AbortError'

/** ApiError means the server answered, so prefer its own wording. */
export const errorText = (err: unknown): string =>
  err instanceof ApiError ? err.message : OFFLINE_MESSAGE
