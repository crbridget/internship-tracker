import { request } from './client'
import type { AddCompanySuccess, Company, Posting, ScoredPosting } from '../types'

export { ApiError, API_BASE } from './client'

// GET /companies — every company with status 'active' 
export function getCompanies(signal?: AbortSignal): Promise<Company[]> {
  return request<Company[]>('/companies', { signal })
}


// POST /companies — checks Greenhouse then Lever, inserting on a hit
export function addCompany(companyName: string, signal?: AbortSignal): Promise<AddCompanySuccess> {
  return request<AddCompanySuccess>('/companies', {
    method: 'POST',
    body: { company_name: companyName },
    signal,
  })
}


// GET /internships — internship-titled open postings, newest first
export function getRecentInternships(limit = 50, signal?: AbortSignal): Promise<Posting[]> {
  return request<Posting[]>(`/internships?limit=${limit}`, { signal })
}


// POST /targets — scores every internship against the target roles, returned
export function scorePostings(targets: string[], signal?: AbortSignal): Promise<ScoredPosting[]> {
  return request<ScoredPosting[]>('/targets', { method: 'POST', body: { targets }, signal })
}