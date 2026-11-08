import type { ReactNode } from 'react'

interface IconProps {
  size?: number
}

// One outline set: 24px grid, 1.5px stroke, drawn in the current text colour.
const Icon = ({ size = 16, children }: IconProps & { children: ReactNode }) => (
  <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
)

export const SearchIcon = (p: IconProps) => <Icon {...p}><circle cx="11" cy="11" r="7.5" /><path d="m20.5 20.5-4.2-4.2" /></Icon>
export const LocationIcon = (p: IconProps) => (
  <Icon {...p}><path d="M20 10c0 5-5.5 10.2-7.4 11.8a1 1 0 0 1-1.2 0C9.5 20.2 4 15 4 10a8 8 0 0 1 16 0" /><circle cx="12" cy="10" r="3" /></Icon>
)
export const ListIcon = (p: IconProps) => (
  <Icon {...p}><path d="M10 6h10M10 12h10M10 18h10" /><path d="m3.5 6 1.5 1.5L7.5 5" /><path d="m3.5 12 1.5 1.5L7.5 11" /><path d="m3.5 18 1.5 1.5L7.5 17" /></Icon>
)
export const BuildingIcon = (p: IconProps) => (
  <Icon {...p}><rect x="4" y="3" width="16" height="18" rx="1.5" /><path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1M10 21v-3h4v3" /></Icon>
)
export const ChevronIcon = (p: IconProps) => <Icon {...p}><path d="m6 9 6 6 6-6" /></Icon>
export const CloseIcon = (p: IconProps) => <Icon {...p}><path d="M18 6 6 18M6 6l12 12" /></Icon>
export const AlertIcon = (p: IconProps) => <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5M12 16v.5" /></Icon>
export const CheckIcon = (p: IconProps) => <Icon {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></Icon>
export const SignInIcon = (p: IconProps) => (
  <Icon {...p}><path d="M15 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3" /><path d="m10 17 5-5-5-5" /><path d="M15 12H3" /></Icon>
)

/** The product mark: a ranked list, three rules of decreasing length, the top one in blue. */
export const Mark = () => (
  <svg className="mark" width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
    <rect className="mark-top" x="2" y="4" width="16" height="2" />
    <rect className="mark-rule" x="2" y="9" width="12" height="2" />
    <rect className="mark-rule" x="2" y="14" width="8" height="2" />
  </svg>
)
