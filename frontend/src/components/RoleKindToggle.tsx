import type { RoleKind } from '../types'

interface RoleKindToggleProps {
  value: RoleKind
  onChange: (kind: RoleKind) => void
  disabled?: boolean
}

const OPTIONS: { kind: RoleKind; label: string }[] = [
  { kind: 'internship', label: 'Internships' },
  { kind: 'fulltime', label: 'Full-time' },
]

/**
 * Which pool to search. role="group" rather than tabs: it filters the list
 * below rather than swapping panels.
 */
export function RoleKindToggle({ value, onChange, disabled = false }: RoleKindToggleProps) {
  return (
    <div className="kind-toggle" role="group" aria-label="Filter by role type">
      {OPTIONS.map(({ kind, label }) => (
        <button
          key={kind}
          type="button"
          className={kind === value ? 'active' : undefined}
          aria-pressed={kind === value}
          disabled={disabled}
          onClick={() => onChange(kind)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
