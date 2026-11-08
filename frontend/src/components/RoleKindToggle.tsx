import type { RoleKind } from '../types'

interface RoleKindToggleProps {
  value: RoleKind
  onChange: (kind: RoleKind) => void
  disabled?: boolean
}

const OPTIONS: { kind: RoleKind; label: string }[] = [
  { kind: 'internship', label: 'Internship' },
  { kind: 'fulltime', label: 'Full-time' },
]

/** Which pool to search. The selected option is underlined in coral; there is no fill. */
export function RoleKindToggle({ value, onChange, disabled = false }: RoleKindToggleProps) {
  return (
    <div className="opt-group" role="group" aria-label="Role type">
      {OPTIONS.map(({ kind, label }) => (
        <button
          key={kind}
          type="button"
          className="opt"
          aria-pressed={kind === value}
          disabled={disabled}
          title={disabled ? 'Wait for the search to finish' : undefined}
          onClick={() => onChange(kind)}
        >
          <span className="lbl">{label}</span>
        </button>
      ))}
    </div>
  )
}
