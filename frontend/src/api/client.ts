// Set VITE_API_URL in the deploy environment to point at the hosted Flask app.
// Falls back to local dev: 127.0.0.1 rather than localhost because on macOS
// localhost can resolve to ::1, where AirPlay Receiver listens on :5000 and
// answers 403.
const FALLBACK_BASE = 'http://127.0.0.1:5000'

// Trailing slash stripped so `${API_BASE}/companies` can't become a double slash.
export const API_BASE = (import.meta.env.VITE_API_URL ?? FALLBACK_BASE).replace(/\/+$/, '')

/**
 * The API answered, but with a non-2xx status. Kept distinct from a network
 * failure so the UI can show the server's own text ("Databricks not found on
 * Greenhouse or Lever") rather than a generic "couldn't reach the server".
 */
export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST'
  body?: unknown
  signal?: AbortSignal
  /**
   * Render's free tier cold-starts in ~20s and /targets adds several more, so
   * this is deliberately generous. Without any timeout a sleeping backend
   * leaves the request hanging forever.
   */
  timeoutMs?: number
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal, timeoutMs = 90_000 } = options

  // Combine rather than choose: a caller-supplied signal (unmount) must not
  // discard the timeout, and vice versa.
  const timeout = AbortSignal.timeout(timeoutMs)
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: combined,
  })

  if (!res.ok) throw new ApiError(res.status, await readErrorMessage(res, method, path))

  return (await res.json()) as T
}

/** Flask sends {error: "..."} on 4xx. Fall back to the status when it doesn't. */
async function readErrorMessage(res: Response, method: string, path: string): Promise<string> {
  try {
    const body: unknown = await res.json()
    if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') {
      return body.error
    }
  } catch {
    // not JSON — e.g. Render's HTML 502 page when a worker dies
  }
  return `${method} ${path} returned ${res.status}`
}
