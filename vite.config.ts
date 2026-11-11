import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Relative Pfade: die App läuft unverändert unter jeder Adresse (GitHub Pages, eigene Seite, Unterordner)
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 1430, strictPort: true },
  // „docs“: GitHub Pages kann diesen Ordner direkt aus dem Hauptzweig veröffentlichen
  build: { outDir: 'docs', target: 'es2020' },
});
