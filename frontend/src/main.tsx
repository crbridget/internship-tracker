import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/react'
import App from './App'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Missing <div id="root"> in index.html')

// Public by design (it ships in the bundle). Vite inlines it at build time, so
// changing it on Vercel needs a redeploy.
const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
if (!publishableKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY. Add it to frontend/.env (see README).')
}

createRoot(rootElement).render(
  <StrictMode>
    <ClerkProvider publishableKey={publishableKey} afterSignOutUrl="/">
      <App />
    </ClerkProvider>
  </StrictMode>,
)
