import { useEffect, useMemo, useState } from 'react'
import { addCompany, getCompanies } from '../api'
import { errorText, isAbort } from '../lib/errors'
import type { Company, CompanyResult } from '../types'

export interface CompaniesState {
  all: Company[]
  /** Alphabetical */
  sorted: Company[]
  namesById: Map<number, string>
  query: string
  setQuery: (value: string) => void
  loading: boolean
  result: CompanyResult | null
  submit: () => Promise<void>
}


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
    return () => controller.abort() 
  }, [])

  const namesById = useMemo(() => new Map(all.map(c => [c.id, c.company_name])), [all])

  const sorted = useMemo(
    () =>
      [...all].sort((a, b) =>
        a.company_name.localeCompare(b.company_name, undefined, { sensitivity: 'base' })
      ),
    [all]
  )

 
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
