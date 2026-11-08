import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@clerk/react'
import { deleteApplication, getApplications, saveApplication } from '../api'
import { errorText, isAbort } from '../lib/errors'
import type { Application, ApplicationStatus, ApplicationUpdate, Posting } from '../types'

export interface ApplicationsState {
  /** Tracking needs an account; signed-out visitors can still browse. */
  signedIn: boolean
  /** Most recently updated first, as of load. Edits keep their position. */
  all: Application[]
  byPostingId: Map<number, Application>
  loading: boolean
  error: string
  /** null stops tracking the posting. */
  setStatus: (posting: Posting, status: ApplicationStatus | null) => Promise<void>
  setNotes: (application: Application, notes: string) => Promise<void>
}

/** Rows tagged with whose they are, so a sign-out or account switch can't show stale ones. */
interface Loaded {
  userId: string
  rows: Application[]
}

/**
 * The signed-in user's tracked postings, shared by Find Roles (status menu on
 * every card) and My Applications. Edits are optimistic: the UI changes
 * immediately and rolls back if the server refuses.
 */
export function useApplications(): ApplicationsState {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth()
  const signedIn = Boolean(isLoaded && isSignedIn && userId)

  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [error, setError] = useState('')

  // Refetch whenever the signed-in account changes.
  useEffect(() => {
    if (!signedIn || !userId) return
    const controller = new AbortController()
    getToken()
      .then(token => getApplications(token, controller.signal))
      .then(rows => setLoaded({ userId, rows }))
      .catch(err => {
        if (isAbort(err)) return
        console.error('Could not load applications:', err)
        setError(errorText(err))
        setLoaded({ userId, rows: [] })
      })
    return () => controller.abort()
    // getToken is a new function each render; the account is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, userId])

  const current = signedIn && loaded?.userId === userId ? loaded : null
  const all = useMemo(() => current?.rows ?? [], [current])
  const byPostingId = useMemo(() => new Map(all.map(a => [a.posting_id, a])), [all])

  /** Replace one posting's entry in place (new ones go first); undefined removes it. */
  const put = (postingId: number, next: Application | undefined) =>
    setLoaded(prev => {
      if (!prev) return prev
      const rows = prev.rows
      const index = rows.findIndex(a => a.posting_id === postingId)
      if (!next) return { ...prev, rows: rows.filter(a => a.posting_id !== postingId) }
      if (index === -1) return { ...prev, rows: [next, ...rows] }
      const copy = [...rows]
      copy[index] = next
      return { ...prev, rows: copy }
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
      const stored = await saveApplication(posting.id, change, await getToken())
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
      await deleteApplication(posting.id, await getToken())
    } catch (err) {
      console.error('Could not untrack posting:', err)
      put(posting.id, previous)
      setError(errorText(err))
    }
  }

  const setStatus = async (posting: Posting, status: ApplicationStatus | null) => {
    if (!signedIn) return
    await (status === null ? remove(posting) : save(posting, { status }))
  }

  const setNotes = (application: Application, notes: string) =>
    save(application.posting, { status: application.status, notes: notes.trim() || null })

  return {
    signedIn,
    all,
    byPostingId,
    loading: signedIn && !current,
    error: signedIn ? error : '',
    setStatus,
    setNotes,
  }
}
