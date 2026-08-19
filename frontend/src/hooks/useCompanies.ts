import { useEffect, useMemo, useState } from 'react'
import { addCompany, getCompanies } from '../api'
import { errorText, isAbort } from '../lib/errors'
import type { Company, CompanyResult } from '../types'

export interface CompaniesState {
  all: Company[]
  /** Alphabetical, case-insensitive, for display. */
  sorted: Company[]
  /** Postings carry company_id, not a name — this resolves it. */
  namesById: Map<number, string>
  query: string
  setQuery: (value: string) => void
  loading: boolean
  result: CompanyResult | null
  submit: () => Promise<void>
}

/**
 * Owns the tracked-company catalog and the add flow.
 *
 * Shared state by necessity: AddCompanies can insert a company, and FindRoles
 * reads the same list to label postings. Called from App so both tabs see one
 * copy and it survives switching between them.
 */
export function useCompanies(): CompaniesState {
  const [all, setAll] = useState<Company[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<CompanyResult | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    getCompanies(controller.signal)
      .then(setAll)
      .catch(err => {
        if (!isAbort(err)) console.error('Could not load companies:', err)
      })
    return () => controller.abort() // cancel in flight if we unmount first
  }, [])

  const namesById = useMemo(() => new Map(all.map(c => [c.id, c.company_name])), [all])

  const sorted = useMemo(
    () =>
      [...all].sort((a, b) =>
        a.company_name.localeCompare(b.company_name, undefined, { sensitivity: 'base' })
      ),
    [all]
  )

  // Two-step: check what we already track before spending an API call, and
  // only fall through to Greenhouse/Lever verification for unknown names.
  const submit = async () => {
    const name = query.trim()
    if (!name) {
      setResult({ kind: 'error', text: 'Enter a company name first.' })
      return
    }

    const tracked = all.find(c => c.company_name.toLowerCase() === name.toLowerCase())
    if (tracked) {
      setResult({ kind: 'found', company: tracked })
      return
    }

    setLoading(true)
    setResult(null)
    try {
      const added = await addCompany(name)
      const refreshed = await getCompanies()
      setAll(refreshed)
      setResult({
        kind: 'added',
        text: added.message,
        company: refreshed.find(c => c.company_name.toLowerCase() === name.toLowerCase()),
      })
      setQuery('')
    } catch (err) {
      console.error('Could not add company:', err)
      setResult({ kind: 'error', text: errorText(err) })
    } finally {
      setLoading(false)
    }
  }

  return { all, sorted, namesById, query, setQuery, loading, result, submit }
}
