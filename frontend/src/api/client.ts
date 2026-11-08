const FALLBACK_BASE = 'http://127.0.0.1:5000'

export const API_BASE = (import.meta.env.VITE_API_URL ?? FALLBACK_BASE).replace(/\/+$/, '')

export class ApiError extends Error {
    readonly status: number 

    constructor(status: number, message: string) {
        super(message)
        this.name = 'ApiError'
        this.status = status
    }
}

interface RequestOptions { 
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
    body?: unknown
    signal?: AbortSignal
    timeoutMs?: number
    /** Clerk session token, for routes that require sign-in. */
    token?: string | null
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal, timeoutMs = 90_000, token } = options

  const timeout = AbortSignal.timeout(timeoutMs)
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: combined,
  })

  if (!res.ok) throw new ApiError(res.status, await readErrorMessage(res, method, path))

  // 204 No Content (DELETE) has no body to parse.
  if (res.status === 204) return undefined as T

  return (await res.json()) as T
}

async function readErrorMessage(res: Response, method: string, path: string): Promise<string> {
  try {
    const body: unknown = await res.json()
    if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') {
      return body.error
    }
  } catch {
    // body wasn't JSON — e.g. Render's HTML 502 page. Fall through.
  }
  return `${method} ${path} returned ${res.status}`
}