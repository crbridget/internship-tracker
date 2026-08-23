
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

  description: string | null
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

export type Tab = 'search' | 'manage'

export type CompanyResult =
  | { kind: 'error'; text: string }
  | { kind: 'found'; company: Company }
  | { kind: 'added'; text: string; company: Company | undefined }
