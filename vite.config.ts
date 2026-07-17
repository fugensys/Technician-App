import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [
      react(), 
      tailwindcss(),
      {
        name: 'version-service-worker',
        buildStart() {
          try {
            const swPath = path.resolve(__dirname, 'public/sw.js');
            if (fs.existsSync(swPath)) {
              let swContent = fs.readFileSync(swPath, 'utf8');
              const version = Date.now();
              swContent = swContent.replace(
                /const CACHE_NAME = ['"][^'"]+['"];/,
                `const CACHE_NAME = 'ac-tech-portal-v${version}';`
              );
              fs.writeFileSync(swPath, swContent, 'utf8');
              console.log(`[Service Worker] Injected cache version: ac-tech-portal-v${version}`);
            }
          } catch (err) {
            console.error('Failed to inject service worker version:', err);
          }
        }
      }
    ],
    define: {
      'process.env.GOOGLE_MAPS_PLATFORM_KEY': JSON.stringify(process.env.GOOGLE_MAPS_PLATFORM_KEY || '')
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
