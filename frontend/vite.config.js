import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Pinned: the backend only accepts sign-in tokens from origins listed in
  // CLERK_AUTHORIZED_PARTIES (http://localhost:5173). Without strictPort, a
  // busy 5173 silently moves the app to 5174+ and every sign-in gets a 401.
  server: { port: 5173, strictPort: true },
})
