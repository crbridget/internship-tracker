import { useEffect, useMemo, useState } from 'react'
import { getRecentInternships, scorePostings } from '../api'
import { errorText, isAbort } from '../lib/errors'
import type { Posting, ScoredPosting } from '../types'

const RECENT_LIMIT = 50

export interface InternshipSearch {
  roleInput: string
  setRoleInput: (value: string) => void
  locationInput: string
  setLocationInput: (value: string) => void
  /** Postings after the location filter — what to render. */
  visible: Posting[]
  /** Postings before the location filter, for the "of N" count. */
  shown: Posting[]
  searched: boolean
  loading: boolean
  /** A search or the initial load is in flight. */
  busy: boolean
  error: string
  submit: () => Promise<void>
}

/**
 * Owns the role/location search and the default "newest internships" list.
 *
 * Called from App rather than from FindRoles so the results survive a tab
 * switch — FindRoles unmounts when the user opens Add Companies.
 */
export function useInternshipSearch(): InternshipSearch {
  const [recent, setRecent] = useState<Posting[]>([])
  const [recentLoading, setRecentLoading] = useState(true)

  const [roleInput, setRoleInput] = useState('')
  const [locationInput, setLocationInput] = useState('')
  const [results, setResults] = useState<ScoredPosting[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState('')

  // Default view: the newest internships. The API filters, sorts and limits.
  useEffect(() => {
    const controller = new AbortController()
    getRecentInternships(RECENT_LIMIT, controller.signal)
      .then(setRecent)
      .catch(err => {
        if (!isAbort(err)) console.error('Could not load internships:', err)
      })
      .finally(() => {
        if (!controller.signal.aborted) setRecentLoading(false)
      })
    return () => controller.abort()
  }, [])

  // ScoredPosting is assignable to Posting — the score is just narrower.
  const shown: Posting[] = searched ? results : recent

  // Location narrows whatever is on screen, so typing filters live without
  // another round trip to the scorer.
  const visible = useMemo(() => {
    const needle = locationInput.trim().toLowerCase()
    if (!needle) return shown
    return shown.filter(job => (job.location ?? '').toLowerCase().includes(needle))
  }, [shown, locationInput])

  const submit = async () => {
    const targets = roleInput
      .split(',')
      .map(part => part.trim())
      .filter(Boolean)

    // An empty role box goes back to the default "newest" view.
    if (targets.length === 0) {
      setSearched(false)
      setResults([])
      setError('')
      return
    }

    setLoading(true)
    setError('')
    try {
      setResults(await scorePostings(targets))
      setSearched(true)
    } catch (err) {
      console.error('Could not score postings:', err)
      setResults([])
      setError(errorText(err))
    } finally {
      setLoading(false)
    }
  }

  return {
    roleInput,
    setRoleInput,
    locationInput,
    setLocationInput,
    visible,
    shown,
    searched,
    loading,
    busy: loading || recentLoading,
    error,
    submit,
  }
}
