import type { Company } from '../types'

// name and status of company
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

// company list
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

// single company result
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
