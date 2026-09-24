/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: { outDir: 'dist', target: 'es2022' },
  // Tests de l'appli (npm test) ; ceux du collecteur passent par node --test.
  test: { include: ['src/**/*.test.ts'] },
});
