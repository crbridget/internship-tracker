import { request } from './client'
import type { AddCompanySuccess, Company, Posting, ScoredPosting } from '../types'

export { ApiError, API_BASE } from './client'

/** GET /companies — every company with status 'active'. */
export function getCompanies(signal?: AbortSignal): Promise<Company[]> {
  return request<Company[]>('/companies', { signal })
}

/**
 * POST /companies — checks Greenhouse then Lever, inserting on a hit.
 * Throws ApiError(404) when the name is on neither board and ApiError(400)
 * when it's blank; `.message` carries the server's own wording.
 */
export function addCompany(companyName: string, signal?: AbortSignal): Promise<AddCompanySuccess> {
  return request<AddCompanySuccess>('/companies', {
    method: 'POST',
    body: { company_name: companyName },
    signal,
  })
}

/**
 * GET /internships — internship-titled open postings, newest first, filtered
 * and sorted server-side.
 *
 * Replaces GET /postings, which returned all ~10.7k open rows (5MB) and left
 * the client to filter and sort.
 */
export function getRecentInternships(limit = 50, signal?: AbortSignal): Promise<Posting[]> {
  return request<Posting[]>(`/internships?limit=${limit}`, { signal })
}

/**
 * POST /targets — scores every internship against the target roles, returned
 * sorted by descending relevance. Every row is scored, hence ScoredPosting.
 */
export function scorePostings(targets: string[], signal?: AbortSignal): Promise<ScoredPosting[]> {
  return request<ScoredPosting[]>('/targets', { method: 'POST', body: { targets }, signal })
}
