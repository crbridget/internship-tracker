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
      <nav className="tabs">
        <button onClick={() => onTabChange('search')} disabled={activeTab === 'search'}>
          Find Roles
        </button>
        <button onClick={() => onTabChange('manage')} disabled={activeTab === 'manage'}>
          Add Companies
        </button>
      </nav>
    </header>
  )
}
