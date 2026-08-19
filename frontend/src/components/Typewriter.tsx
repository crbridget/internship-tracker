import { useEffect, useState } from 'react'


const prefersReducedMotion = (): boolean =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

interface TypewriterProps {
  text: string
  typeSpeed?: number
  eraseSpeed?: number
  holdFull?: number
  holdEmpty?: number
}

export function Typewriter({
  text,
  typeSpeed = 45,
  eraseSpeed = 25,
  holdFull = 900,
  holdEmpty = 350,
}: TypewriterProps) {
  const [reduced] = useState(prefersReducedMotion)
  const [count, setCount] = useState(() => (prefersReducedMotion() ? text.length : 0))
  const [erasing, setErasing] = useState(false)

  useEffect(() => {
    if (reduced) return

    const atEnd = !erasing && count === text.length
    const atStart = erasing && count === 0
    const delay = atEnd ? holdFull : atStart ? holdEmpty : erasing ? eraseSpeed : typeSpeed

    const id = setTimeout(() => {
      if (atEnd) setErasing(true)
      else if (atStart) setErasing(false)
      else setCount(c => c + (erasing ? -1 : 1))
    }, delay)

    return () => clearTimeout(id)
  }, [count, erasing, text, reduced, typeSpeed, eraseSpeed, holdFull, holdEmpty])

  return (
    <span aria-hidden="true">
      {text.slice(0, count)}
      {!reduced && <span className="caret" />}
    </span>
  )
}