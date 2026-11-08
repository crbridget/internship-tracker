import { request } from './client'
import type {
  AddCompanySuccess,
  Application,
  ApplicationRecord,
  ApplicationUpdate,
  Company,
  Posting,
  RoleKind,
  ScoredPosting,
} from '../types'

export { ApiError, API_BASE } from './client'

// GET /companies — every company with status 'active' 
export function getCompanies(signal?: AbortSignal): Promise<Company[]> {
  return request<Company[]>('/companies', { signal })
}


// POST /companies — checks Greenhouse then Lever, inserting on a hit. Requires sign-in.
export function addCompany(
  companyName: string,
  token: string | null,
  signal?: AbortSignal,
): Promise<AddCompanySuccess> {
  return request<AddCompanySuccess>('/companies', {
    method: 'POST',
    body: { company_name: companyName },
    token,
    signal,
  })
}


// GET /internships — internship-titled open postings, newest first
export function getRecentPostings(
  kind: RoleKind = 'internship',
  limit = 50,
  signal?: AbortSignal,
): Promise<Posting[]> {
  return request<Posting[]>(`/internships?kind=${kind}&limit=${limit}`, { signal })
}


// POST /targets — scores every internship against the target roles, returned
export function scorePostings(
  targets: string[],
  kind: RoleKind = 'internship',
  signal?: AbortSignal,
): Promise<ScoredPosting[]> {
  return request<ScoredPosting[]>(`/targets?kind=${kind}`, {
    method: 'POST',
    body: { targets },
    signal,
  })
}


// The /applications routes all require sign-in and act on the signed-in user.

// GET /applications — every tracked posting, most recently updated first
export function getApplications(token: string | null, signal?: AbortSignal): Promise<Application[]> {
  return request<Application[]>('/applications', { token, signal })
}


// PUT /applications/:postingId — track a posting, or change its status/notes
export function saveApplication(
  postingId: number,
  update: ApplicationUpdate,
  token: string | null,
  signal?: AbortSignal,
): Promise<ApplicationRecord> {
  return request<ApplicationRecord>(`/applications/${postingId}`, {
    method: 'PUT',
    body: update,
    token,
    signal,
  })
}


// DELETE /applications/:postingId — stop tracking a posting
export function deleteApplication(
  postingId: number,
  token: string | null,
  signal?: AbortSignal,
): Promise<void> {
  return request<void>(`/applications/${postingId}`, { method: 'DELETE', token, signal })
}
