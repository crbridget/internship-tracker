import type { Company } from '../types'

// Shared so the list row and the search-result row can't drift apart.
function NameAndStatus({ company }: { company: Company }) {
  return (
    <>
      <span>{company.company_name}</span>
      <span className={`badge ${company.status}`}>{company.status}</span>
    </>
  )
}

interface CompanyListProps {
  companies: Company[]
}

export function CompanyList({ companies }: CompanyListProps) {
  return (
    <ul className="company-list">
      {companies.map(company => (
        <li key={company.id} className="company-row">
          <NameAndStatus company={company} />
        </li>
      ))}
    </ul>
  )
}

interface CompanyHighlightProps {
  company: Company
  label: string
}

/**
 * The single company surfaced by a search, above the full list.
 *
 * A div rather than an li because it sits outside the <ul> — .company-row is
 * styled by class, not by element, so both render identically.
 */
export function CompanyHighlight({ company, label }: CompanyHighlightProps) {
  return (
    <div className="company-result">
      <div className="company-result-label">{label}</div>
      <div className="company-row highlight">
        <NameAndStatus company={company} />
      </div>
    </div>
  )
}
