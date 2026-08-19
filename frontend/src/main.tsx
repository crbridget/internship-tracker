import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

// getElementById returns HTMLElement | null, so strict mode won't let this be
// passed straight to createRoot. An explicit throw beats a `!` assertion: if the
// div ever goes missing from index.html, the error says what's wrong.
const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Missing <div id="root"> in index.html')

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
