/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The browser talks to AI running on this computer through these local paths.
// Keeping them same-origin avoids asking people to configure CORS by hand.
const privateAI = process.env.WORKSHOP_PRIVATE_AI_URL ?? 'http://127.0.0.1:11434';
const imageStudio = process.env.WORKSHOP_IMAGE_STUDIO_URL ?? 'http://127.0.0.1:7860';

const proxy = {
  '/local/ai': { target: privateAI, changeOrigin: true, rewrite: (p: string) => p.replace(/^\/local\/ai/, '') },
  '/local/images': { target: imageStudio, changeOrigin: true, rewrite: (p: string) => p.replace(/^\/local\/images/, '') },
};

export default defineConfig({
  plugins: [react()],
  server: { proxy },
  preview: { proxy },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
