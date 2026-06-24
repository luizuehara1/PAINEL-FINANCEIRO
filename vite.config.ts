import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import dotenv from 'dotenv';

// Load .env and .env.local
dotenv.config();
dotenv.config({ path: '.env.local', override: true });

export default defineConfig(() => {
  // Filter process.env to only expose NEXT_PUBLIC_ variables to the client
  const processEnv: Record<string, string | undefined> = {};
  for (const key in process.env) {
    if (key.startsWith('NEXT_PUBLIC_')) {
      processEnv[key] = process.env[key];
    }
  }

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    define: {
      'process.env': processEnv,
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
