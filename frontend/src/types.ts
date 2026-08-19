/**
 * Shapes returned by the Flask API.
 *
 * Nullability here is measured against all 10,661 open postings and all 64
 * companies rather than guessed — counts are noted per field. Where a column is
 * always null today but the backend can populate it, the type allows null.
 */

// Only these two boards are implemented in greenhouse_lever_check.py.
export type Source = 'greenhouse' | 'lever'

// Observed data shows only 'active'/'open', but that's an artifact of the
// queries filtering on them. The real domains come from the writers:
// update_company_status() sets 'inactive', poll_company() sets 'closed'.
export type CompanyStatus = 'active' | 'inactive'
export type PostingStatus = 'open' | 'closed'

/** A tracked company. GET /companies returns Company[]. */
export interface Company {
  id: number
  company_name: string
  source: Source
  source_token: string
  status: CompanyStatus
  /** ISO 8601, no timezone offset. */
  verified_date: string
  last_checked: string
  consecutive_failures: number
}

/** A job posting row. */
export interface Posting {
  id: number
  /** Matches Company.id. Both are numbers — no coercion needed. */
  company_id: number
  external_job_id: string
  title: string

  /**
   * Never null across 10,661 rows, but normalize_lever_posting() reads
   * `categories.location` with .get(), so Lever can yield null.
   */
  location: string | null

  apply_url: string

  /** null on 1,354/10,661 — Lever never provides it. */
  first_published: string | null
  /** null on 1,346/10,661. */
  source_updated_at: string | null

  first_seen_at: string
  last_seen_at: string
  status: PostingStatus

  /**
   * null on 9,529/10,661 — only set once a posting has been scored, and it
   * reflects whatever targets were searched last, not the current query.
   */
  relevance_score: number | null

  /** Column exists but is null on every row; nothing writes it yet. */
  user_label: string | null

  /** Column exists but is null on every row; the pollers don't fetch it. */
  description: string | null
}

/**
 * POST /targets scores everything it returns, so the score is guaranteed.
 * GET /internships makes no such promise — hence the separate type.
 */
export type ScoredPosting = Omit<Posting, 'relevance_score'> & {
  relevance_score: number
}

/** POST /companies on success — app.py returns the board it was found on. */
export interface AddCompanySuccess {
  message: string
  source: Source
}

/** POST /companies on failure (404 when absent from both boards, 400 on bad input). */
export interface AddCompanyError {
  error: string
}

// ---------------------------------------------------------------------------
// UI state. These are not API shapes; they may move next to their components
// once those exist.
// ---------------------------------------------------------------------------

export type Tab = 'search' | 'manage'

/**
 * Result of the two-step company lookup: 'found' short-circuits on the local
 * catalog, 'added' means the API verified and inserted it.
 *
 * `company` is optional on 'added' because it comes from a .find() over the
 * refetched list, which can miss.
 */
export type CompanyResult =
  | { kind: 'error'; text: string }
  | { kind: 'found'; company: Company }
  | { kind: 'added'; text: string; company: Company | undefined }
