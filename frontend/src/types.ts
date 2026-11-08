
export type Source = 'greenhouse' | 'lever'

export type CompanyStatus = 'active' | 'inactive'
export type PostingStatus = 'open' | 'closed'

export interface Company {
  id: number
  company_name: string
  source: Source
  source_token: string
  status: CompanyStatus
  verified_date: string
  last_checked: string
  consecutive_failures: number
}


export interface Posting {
  id: number
  company_id: number
  external_job_id: string
  title: string

  location: string | null

  apply_url: string

  first_published: string | null
  source_updated_at: string | null

  first_seen_at: string
  last_seen_at: string
  status: PostingStatus

  // Optional, not nullable: no longer a database column. 
  relevance_score?: number

  // description is deliberately absent: the API never selects it (see
  // POSTING_COLUMNS in backend/db.py), it's ~6KB per posting.
}

/** /targets scores everything it returns, so the score is guaranteed there. */
export type ScoredPosting = Posting & {
  relevance_score: number
}

export interface AddCompanySuccess {
  message: string
  source: Source
}

export interface AddCompanyError {
  error: string
}

export type Tab = 'search' | 'applications' | 'manage'

/**
 * Which pool to search. 'fulltime' means "not an internship" — there's no
 * employment-type column, so the title is the only signal, and contract and
 * part-time roles land here too.
 */
export type RoleKind = 'internship' | 'fulltime'

export type CompanyResult =
  | { kind: 'error'; text: string }
  | { kind: 'found'; company: Company }
  | { kind: 'added'; text: string; company: Company | undefined }

/** Mirrors the CHECK constraint in db/migrations/005_applications.sql. */
export const APPLICATION_STATUSES = ['saved', 'applied', 'interviewing', 'offer', 'rejected'] as const
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number]

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  saved: 'Saved',
  applied: 'Applied',
  interviewing: 'Interviewing',
  offer: 'Offer',
  rejected: 'Rejected',
}

/** One row of PUT /applications/:id. */
export interface ApplicationRecord {
  posting_id: number
  status: ApplicationStatus
  notes: string | null
  /** YYYY-MM-DD */
  applied_at: string | null
  created_at: string
  updated_at: string
}

/** One row of GET /applications, which embeds the posting. */
export type Application = ApplicationRecord & {
  posting: Posting
}

/**
 * Body of PUT /applications/:id. Omitted fields are left alone; null clears.
 */
export interface ApplicationUpdate {
  status: ApplicationStatus
  notes?: string | null
  applied_at?: string | null
}
