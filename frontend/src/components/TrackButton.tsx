import { SignInButton } from '@clerk/react'
import { StatusSelect } from './StatusSelect'
import type { ApplicationStatus } from '../types'

interface TrackButtonProps {
  signedIn: boolean
  status: ApplicationStatus | null
  onChange: (status: ApplicationStatus | null) => void
}

/** The status menu, or, signed out, a look-alike that opens sign-in. */
export function TrackButton({ signedIn, status, onChange }: TrackButtonProps) {
  if (signedIn) return <StatusSelect status={status} onChange={onChange} />
  return (
    <SignInButton mode="modal">
      <button type="button" className="status-select untracked" title="Sign in to track roles">
        + Track
      </button>
    </SignInButton>
  )
}
