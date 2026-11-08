import { useState } from 'react'
import './App.css'
import { Header } from './components/Header'
import { AddCompanies } from './features/AddCompanies'
import { Applications } from './features/Applications'
import { FindRoles } from './features/FindRoles'
import { useApplications } from './hooks/useApplications'
import { useCompanies } from './hooks/useCompanies'
import { useInternshipSearch } from './hooks/useInternshipSearch'
import type { Tab } from './types'


function App() {
  const [activeTab, setActiveTab] = useState<Tab>('search')
  const companies = useCompanies()
  const search = useInternshipSearch()
  const applications = useApplications()

  return (
    <div className="app">
      <Header activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === 'search' && (
        <FindRoles
          search={search}
          companyNames={companies.namesById}
          applications={applications}
        />
      )}

      {activeTab === 'applications' && (
        <Applications applications={applications} companyNames={companies.namesById} />
      )}

      {activeTab === 'manage' && <AddCompanies companies={companies} />}
    </div>
  )
}

export default App
