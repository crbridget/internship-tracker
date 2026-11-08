import { SignInButton } from '@clerk/react'
import { StatusSelect } from './StatusSelect'
import type { ApplicationStatus } from '../types'

interface TrackButtonProps {
  signedIn: boolean
  status: ApplicationStatus | null
  onChange: (status: ApplicationStatus | null) => void
  label: string
}

/** "+ Track" until the posting is tracked, then its stage tag. Signed out, it opens sign-in. */
export function TrackButton({ signedIn, status, onChange, label }: TrackButtonProps) {
  if (signedIn && status) return <StatusSelect status={status} onChange={onChange} label={`Stage for ${label}`} />
  const button = (
    <button
      type="button"
      className="btn outline small"
      aria-label={`Track ${label}`}
      title={signedIn ? undefined : 'Sign in to track roles'}
      onClick={signedIn ? () => onChange('saved') : undefined}
    >
      <span className="bx">+ Track</span>
    </button>
  )
  return signedIn ? button : <SignInButton mode="modal">{button}</SignInButton>
}
