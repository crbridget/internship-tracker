import { useEffect, useMemo, useState } from 'react'
import { deleteApplication, getApplications, saveApplication } from '../api'
import { errorText, isAbort } from '../lib/errors'
import type { Application, ApplicationStatus, ApplicationUpdate, Posting } from '../types'

export interface ApplicationsState {
  /** Most recently updated first, as of load. Edits keep their position. */
  all: Application[]
  byPostingId: Map<number, Application>
  loading: boolean
  error: string
  /** null stops tracking the posting. */
  setStatus: (posting: Posting, status: ApplicationStatus | null) => Promise<void>
  setNotes: (application: Application, notes: string) => Promise<void>
}

/**
 * Tracked postings, shared by Find Roles (status menu on every card) and
 * My Applications. Edits are optimistic: the UI changes immediately and rolls
 * back if the server refuses.
 */
export function useApplications(): ApplicationsState {
  const [all, setAll] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    getApplications(controller.signal)
      .then(setAll)
      .catch(err => {
        if (isAbort(err)) return
        console.error('Could not load applications:', err)
        setError(errorText(err))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [])

  const byPostingId = useMemo(() => new Map(all.map(a => [a.posting_id, a])), [all])

  /** Replace one posting's entry in place (new ones go first); undefined removes it. */
  const put = (postingId: number, next: Application | undefined) =>
    setAll(prev => {
      const index = prev.findIndex(a => a.posting_id === postingId)
      if (!next) return prev.filter(a => a.posting_id !== postingId)
      if (index === -1) return [next, ...prev]
      const copy = [...prev]
      copy[index] = next
      return copy
    })

  const save = async (posting: Posting, change: ApplicationUpdate) => {
    const previous = byPostingId.get(posting.id)
    const now = new Date().toISOString()
    put(posting.id, {
      posting_id: posting.id,
      status: change.status,
      notes: change.notes !== undefined ? change.notes : previous?.notes ?? null,
      // The server decides applied_at; show the old value until it answers.
      applied_at: previous?.applied_at ?? null,
      created_at: previous?.created_at ?? now,
      updated_at: now,
      posting,
    })
    setError('')
    try {
      const stored = await saveApplication(posting.id, change)
      put(posting.id, { ...stored, posting })
    } catch (err) {
      console.error('Could not save application:', err)
      put(posting.id, previous)
      setError(errorText(err))
    }
  }

  const remove = async (posting: Posting) => {
    const previous = byPostingId.get(posting.id)
    if (!previous) return
    put(posting.id, undefined)
    setError('')
    try {
      await deleteApplication(posting.id)
    } catch (err) {
      console.error('Could not untrack posting:', err)
      put(posting.id, previous)
      setError(errorText(err))
    }
  }

  const setStatus = (posting: Posting, status: ApplicationStatus | null) =>
    status === null ? remove(posting) : save(posting, { status })

  const setNotes = (application: Application, notes: string) =>
    save(application.posting, { status: application.status, notes: notes.trim() || null })

  return { all, byPostingId, loading, error, setStatus, setNotes }
}
