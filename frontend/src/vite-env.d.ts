/// <reference types="vite/client" />

// Without this, `import.meta.env.VITE_API_URL` is an error under strict mode.
// Optional because the app falls back to localhost when it isn't set — see the
// API base in App.jsx.
interface ImportMetaEnv {
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
