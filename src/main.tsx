import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Deliberately no StrictMode: its double-invoked effects would open the
// microphone and arm the wake-word engine twice, and the second subscription
// steals the audio stream from the first.
createRoot(document.getElementById('root')!).render(<App />)

// Installed-app support (public/sw.js). Production builds only — in
// `npm run dev` a caching worker would serve stale modules over Vite's HMR.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
    // No worker (private mode, unsupported browser) just means no offline shell.
  })
}
