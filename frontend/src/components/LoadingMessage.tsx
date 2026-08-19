import { Typewriter } from './Typewriter'

interface LoadingMessageProps {
  message: string
}

/**
 * The dashed placeholder shown while a request is in flight.
 *
 * aria-label carries the whole message so screen readers announce it once,
 * rather than announcing every partially typed frame as the Typewriter runs.
 */
export function LoadingMessage({ message }: LoadingMessageProps) {
  return (
    <div className="empty loading" role="status" aria-label={message}>
      <Typewriter text={message} />
    </div>
  )
}
