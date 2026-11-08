import { useEffect, useState } from 'react'
import type { Route } from '../types'

const ROUTES: Route[] = ['roles', 'applications', 'companies']

function read(): Route {
  const match = window.location.hash.match(/^#\/(\w+)/)
  const route = match?.[1] as Route | undefined
  return route && ROUTES.includes(route) ? route : 'roles'
}

/** The current view, kept in the URL hash so each view can be linked and the back button works. */
export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(read)
  useEffect(() => {
    const onChange = () => {
      setRoute(read())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}
