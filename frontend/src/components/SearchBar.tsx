import type { ReactNode } from 'react'

interface SearchFieldProps {
  icon: ReactNode
  placeholder: string
  value: string
  onChange: (value: string) => void
  /** Enter submits, matching the bar's button. */
  onEnter?: () => void
}

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

/**
 * Sits between two SearchFields.
 *
 * Explicit rather than auto-inserted by SearchBar, because App.css sizes the
 * location input via `.search-field:nth-of-type(2)`. That selector only works
 * while the fields are direct div children of .searchbar in source order, so
 * the DOM shape needs to stay visible at the call site.
 */
export function SearchDivider() {
  return <span className="search-divider" />
}

interface SearchBarProps {
  /** SearchField elements, and a SearchDivider between them if there are two. */
  children: ReactNode
  onSubmit: () => void
  loading?: boolean
  label?: string
  loadingLabel?: string
}

/**
 * The pill-shaped bar: holds the fields and owns the submit button, which must
 * stay the last child for the rounded right edge to land on it.
 */
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
