import { useEffect, useMemo, useState } from 'react'
import { getRecentPostings, scorePostings } from '../api'
import { errorText, isAbort } from '../lib/errors'
import type { Posting, RoleKind, ScoredPosting } from '../types'

const RECENT_LIMIT = 50

export interface InternshipSearch {
  kind: RoleKind
  /** Switching kind refetches the list, and re-runs the search if there is one. */
  setKind: (kind: RoleKind) => void
  roleInput: string
  setRoleInput: (value: string) => void
  locationInput: string
  setLocationInput: (value: string) => void
  visible: Posting[]
  shown: Posting[]
  searched: boolean
  loading: boolean
  busy: boolean
  error: string
  submit: () => Promise<void>
}

export function useInternshipSearch(): InternshipSearch {
  const [kind, setKindState] = useState<RoleKind>('internship')

  const [recent, setRecent] = useState<Posting[]>([])
  const [recentLoading, setRecentLoading] = useState(true)

  const [roleInput, setRoleInput] = useState('')
  const [locationInput, setLocationInput] = useState('')
  const [results, setResults] = useState<ScoredPosting[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState('')

  // Default view: the newest postings of the chosen kind. Re-runs when kind
  // changes, which is why kind is in the dependency array.
  useEffect(() => {
    const controller = new AbortController()
    getRecentPostings(kind, RECENT_LIMIT, controller.signal)
      .then(setRecent)
      .catch(err => {
        if (!isAbort(err)) console.error('Could not load postings:', err)
      })
      .finally(() => {
        if (!controller.signal.aborted) setRecentLoading(false)
      })
    return () => controller.abort()
  }, [kind])

  const shown: Posting[] = searched ? results : recent

  const visible = useMemo(() => {
    const needle = locationInput.trim().toLowerCase()
    if (!needle) return shown
    return shown.filter(job => (job.location ?? '').toLowerCase().includes(needle))
  }, [shown, locationInput])

  /**
   * Takes kind explicitly rather than reading state: setKind's update hasn't
   * landed yet when a toggle triggers a re-search, so the closure would see the
   * old value.
   */
  const runSearch = async (forKind: RoleKind) => {
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
      setResults(await scorePostings(targets, forKind))
      setSearched(true)
    } catch (err) {
      console.error('Could not score postings:', err)
      setResults([])
      setError(errorText(err))
    } finally {
      setLoading(false)
    }
  }

  const setKind = (next: RoleKind) => {
    if (next === kind) return
    setKindState(next)
    // Loading is flipped here rather than in the effect: setting state
    // synchronously inside an effect trips react-hooks/set-state-in-effect.
    setRecentLoading(true)
    if (searched) void runSearch(next)
  }

  return {
    kind,
    setKind,
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
    submit: () => runSearch(kind),
  }
}
