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
  visible: Posting[]
  shown: Posting[]
  searched: boolean
  loading: boolean
  busy: boolean
  error: string
  submit: () => Promise<void>
}

export function useInternshipSearch(): InternshipSearch {
  const [recent, setRecent] = useState<Posting[]>([])
  const [recentLoading, setRecentLoading] = useState(true)

  const [roleInput, setRoleInput] = useState('')
  const [locationInput, setLocationInput] = useState('')
  const [results, setResults] = useState<ScoredPosting[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState('')

  // default view: the newest internships 
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

  const shown: Posting[] = searched ? results : recent

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
