import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// VITE_BASE lets the GitHub Pages workflow build for a project sub-path
// (e.g. /benzenoid-builder/) without touching this file.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  server: { port: 5173, strictPort: true },
});
