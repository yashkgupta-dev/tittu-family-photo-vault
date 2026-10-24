import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  // CRITICAL SECURITY GUARD:
  // If VITE_SUPABASE_ANON_KEY contains a privileged secret key ("sb_secret_..." or "service_role"),
  // sanitize it before Vite inlines it into the public browser bundle.
  // The secret key must remain exclusively on the server in server.ts.
  const rawKey = (process.env.VITE_SUPABASE_ANON_KEY || '').trim();
  const isSecret = rawKey.startsWith('sb_secret_') || rawKey.includes('service_role');
  // Never expose secret key to frontend; if secret key is present, provide empty string (no fake key string)
  const safeClientAnonKey = isSecret ? '' : rawKey;

  return {
    define: {
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(safeClientAnonKey),
    },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.png', 'apple-touch-icon.png', 'icon.svg'],
        manifest: {
          id: '/',
          name: 'TITTU — Personal Family Photo Vault',
          short_name: 'TITTU',
          description: 'Every memory, safely kept. Private cloud photo and video vault.',
          theme_color: '#0F172A',
          background_color: '#FDFBF7',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(process.cwd(), '.'),
      },
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
