import type { ReactNode } from 'react'

interface SearchFieldProps {
  icon: ReactNode
  placeholder: string
  value: string
  onChange: (value: string) => void
  onEnter?: () => void
}

// search field
export function SearchField({ icon, placeholder, value, onChange, onEnter }: SearchFieldProps) {
  return (
    <div className="search-field">
      {icon}
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') onEnter?.()
        }}
      />
    </div>
  )
}


// divider for between elements
export function SearchDivider() {
  return <span className="search-divider" />
}

// search field elements
interface SearchBarProps {
  children: ReactNode
  onSubmit: () => void
  loading?: boolean
  label?: string
  loadingLabel?: string
}

// The pill-shaped bar, holds the fields and owns submit button
export function SearchBar({
  children,
  onSubmit,
  loading = false,
  label = 'Search',
  loadingLabel = 'Searching…',
}: SearchBarProps) {
  return (
    <div className="searchbar">
      {children}
      <button className="search-button" onClick={onSubmit} disabled={loading}>
        {loading ? loadingLabel : label}
      </button>
    </div>
  )
}
