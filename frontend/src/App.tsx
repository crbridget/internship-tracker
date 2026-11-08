import { useEffect } from 'react'
import './App.css'
import { Rail } from './components/Rail'
import { Applications } from './features/Applications'
import { Companies } from './features/Companies'
import { FindRoles } from './features/FindRoles'
import { useApplications } from './hooks/useApplications'
import { useCompanies } from './hooks/useCompanies'
import { useInternshipSearch } from './hooks/useInternshipSearch'
import { useRoute } from './hooks/useRoute'

const TITLES = { roles: 'Find roles', applications: 'My applications', companies: 'Companies' } as const

function App() {
  const route = useRoute()
  const companies = useCompanies()
  const search = useInternshipSearch()
  const applications = useApplications()

  useEffect(() => {
    document.title = `${TITLES[route]} · Internship Tracker`
  }, [route])

  return (
    <div className="viewport">
      <div className="app">
        <Rail route={route} trackedCount={applications.signedIn && !applications.loading ? applications.all.length : null} />
        <main className="canvas">
          {route === 'roles' && (
            <FindRoles search={search} companyNames={companies.namesById} companyCount={companies.all.length} applications={applications} />
          )}
          {route === 'applications' && (
            <Applications applications={applications} companyNames={companies.namesById} companyCount={companies.all.length} />
          )}
          {route === 'companies' && <Companies companies={companies} />}
        </main>
      </div>
    </div>
  )
}

export default App
