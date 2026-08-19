import { useState } from 'react'
import './App.css'
import { Header } from './components/Header'
import { AddCompanies } from './features/AddCompanies'
import { FindRoles } from './features/FindRoles'
import { useCompanies } from './hooks/useCompanies'
import { useInternshipSearch } from './hooks/useInternshipSearch'
import type { Tab } from './types'

/**
 * Both hooks are called here rather than inside the feature components, so
 * search results and the company catalog survive switching tabs — the feature
 * components unmount, App doesn't.
 */
function App() {
  const [activeTab, setActiveTab] = useState<Tab>('search')
  const companies = useCompanies()
  const search = useInternshipSearch()

  return (
    <div className="app">
      <Header activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === 'search' && (
        <FindRoles search={search} companyNames={companies.namesById} />
      )}

      {activeTab === 'manage' && <AddCompanies companies={companies} />}
    </div>
  )
}

export default App
