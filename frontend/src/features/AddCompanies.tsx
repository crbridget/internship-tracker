import { CompanyHighlight, CompanyList } from '../components/CompanyList'
import { SearchIcon } from '../components/icons'
import { SearchBar, SearchField } from '../components/SearchBar'
import type { CompaniesState } from '../hooks/useCompanies'

interface AddCompaniesProps {
  companies: CompaniesState
}

export function AddCompanies({ companies }: AddCompaniesProps) {
  const { all, sorted, query, setQuery, loading, result, submit } = companies

  return (
    <>
      <SearchBar onSubmit={submit} loading={loading} loadingLabel="Checking…">
        <SearchField
          icon={<SearchIcon />}
          placeholder="Search a company — adds it if not already tracked"
          value={query}
          onChange={setQuery}
          onEnter={submit}
        />
      </SearchBar>

      <p className="search-hint">
        Checks your tracked companies first, then Greenhouse and Lever.
      </p>

      {result?.kind === 'error' && <div className="message error">{result.text}</div>}

      {result && result.kind !== 'error' && result.company && (
        <CompanyHighlight
          company={result.company}
          label={result.kind === 'found' ? 'Already tracked' : result.text}
        />
      )}

      <div className="results-count">Tracked Companies ({all.length})</div>

      <CompanyList companies={sorted} />
    </>
  )
}
