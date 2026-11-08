import { Show, SignInButton, UserButton } from '@clerk/react'
import type { Tab } from '../types'

interface HeaderProps {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
}

// tab headers
export function Header({ activeTab, onTabChange }: HeaderProps) {
  return (
    <header className="header">
      <div className="brand">Internship Tracker</div>
      <div className="header-right">
        <nav className="tabs">
          <button onClick={() => onTabChange('search')} disabled={activeTab === 'search'}>
            Find Roles
          </button>
          <button onClick={() => onTabChange('applications')} disabled={activeTab === 'applications'}>
            My Applications
          </button>
          <button onClick={() => onTabChange('manage')} disabled={activeTab === 'manage'}>
            Add Companies
          </button>
        </nav>
        <Show when="signed-in">
          <UserButton />
        </Show>
        <Show when="signed-out">
          <SignInButton mode="modal">
            <button type="button" className="sign-in-button">Sign in</button>
          </SignInButton>
        </Show>
      </div>
    </header>
  )
}
