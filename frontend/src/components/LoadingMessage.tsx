import { Typewriter } from './Typewriter'

interface LoadingMessageProps {
  message: string
}

// The dashed placeholder shown while a request is in flight.
export function LoadingMessage({ message }: LoadingMessageProps) {
  return (
    <div className="empty loading" role="status" aria-label={message}>
      <Typewriter text={message} />
    </div>
  )
}
