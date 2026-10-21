import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages serves the app under /Jarvis-Mobile/, not the domain root.
  // The Pages workflow sets PAGES_BASE; local dev and preview stay at '/'.
  base: process.env.PAGES_BASE || '/',
  server: {
    // Honour PORT so a second instance can run alongside the first. The bridge
    // only accepts sockets from localhost:5173-5199, so stay inside that range
    // or set JARVIS_ALLOWED_ORIGINS to match.
    port: Number(process.env.PORT) || 5173,
    // Lets the app be reached as http://jarvis.localhost:<port> instead of
    // plain localhost — Chrome/Edge resolve any *.localhost name to 127.0.0.1
    // on their own (no hosts-file entry needed), but Vite still has to be told
    // to accept that Host header or it refuses the request outright. A custom
    // origin also has to be added to JARVIS_ALLOWED_ORIGINS for the bridge (see
    // bridge/server.mjs) since it only auto-trusts plain localhost/127.0.0.1.
    allowedHosts: ['jarvis.localhost'],
  },
  optimizeDeps: {
    // kokoro-js pulls in `phonemizer`, which carries espeak-ng as inline WASM.
    // Vite's dependency pre-bundler rewrites that initialisation and the
    // language table ends up empty — the symptom is
    // `Invalid language identifier: "en". Should be one of: .` at generate()
    // time, long after the model has loaded successfully. Serving these
    // untouched fixes it.
    exclude: ['kokoro-js', 'phonemizer', '@huggingface/transformers'],
  },
})
