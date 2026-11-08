import type { ReactNode } from 'react'
import { Show, SignInButton, UserButton } from '@clerk/react'
import { BuildingIcon, ListIcon, Mark, SearchIcon, SignInIcon } from './icons'
import type { Route } from '../types'

interface RailProps {
  route: Route
  /** Shown in the My applications tooltip, e.g. "14 tracked". */
  trackedCount: number | null
}

const NAV: { route: Route; label: string; short: string; icon: ReactNode }[] = [
  { route: 'roles', label: 'Find roles', short: 'Roles', icon: <SearchIcon /> },
  { route: 'applications', label: 'My applications', short: 'Applications', icon: <ListIcon /> },
  { route: 'companies', label: 'Companies', short: 'Companies', icon: <BuildingIcon /> },
]

/**
 * The shell: a narrow icon rail on desktop (the mark, three destinations, the account at the foot),
 * which becomes a labelled bottom bar on a phone.
 */
export function Rail({ route, trackedCount }: RailProps) {
  return (
    <nav className="rail" aria-label="Main">
      <a className="rail-mark" href="#/roles" aria-label="Internship Tracker">
        <Mark />
      </a>
      <div className="rail-nav">
        {NAV.map(item => {
          const tip = item.route === 'applications' && trackedCount !== null
            ? `${item.label} · ${trackedCount} tracked`
            : item.label
          return (
            <a
              key={item.route}
              className="rail-item"
              href={`#/${item.route}`}
              aria-label={tip}
              data-tip={tip}
              aria-current={route === item.route ? 'page' : undefined}
            >
              {item.icon}
              <span className="rail-lbl">{item.short}</span>
            </a>
          )
        })}
      </div>
      <div className="rail-foot">
        <Show when="signed-in">
          <span className="rail-user"><UserButton /></span>
        </Show>
        <Show when="signed-out">
          <SignInButton mode="modal">
            <button type="button" className="rail-item" aria-label="Sign in" data-tip="Sign in">
              <SignInIcon />
            </button>
          </SignInButton>
        </Show>
      </div>
    </nav>
  )
}

interface PageHeaderProps {
  title: string
  /** One sentence about the data: the finding, built from the rows. */
  finding: ReactNode
  companyCount: number
}

/** Scope line, the one h1, and the finding. */
export function PageHeader({ title, finding, companyCount }: PageHeaderProps) {
  return (
    <header className="head">
      <p className="scope">
        <span className="scope-mark"><Mark /></span>
        <span>Internship Tracker · <span className="num">{companyCount}</span> companies · Greenhouse, Lever</span>
      </p>
      <h1>{title}</h1>
      <p className="finding">{finding}</p>
    </header>
  )
}
