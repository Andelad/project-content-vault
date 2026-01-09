import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { visualizer } from 'rollup-plugin-visualizer';
import { componentTagger } from "lovable-tagger";
import { VitePWA } from 'vite-plugin-pwa';
import removeConsole from 'vite-plugin-remove-console';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  test: {
    globals: true,
    environment: 'jsdom',
  },
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' && componentTagger(),
    mode === 'production' && removeConsole(), // Remove console logs in production
    visualizer({
      filename: 'dist/stats.html',
      open: false,
      gzipSize: true
    }),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'robots.txt'],
      manifest: {
        name: 'Project Content Vault',
        short_name: 'Content Vault',
        description: 'Project planning and content management application',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 // 24 hours
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ].filter(Boolean),
  resolve: {
    alias: [
      // DDD Layer paths (most specific first)
      { find: "@/domain", replacement: path.resolve(__dirname, "./src/domain") },
      { find: "@/application", replacement: path.resolve(__dirname, "./src/application") },
      { find: "@/infrastructure", replacement: path.resolve(__dirname, "./src/infrastructure") },
      { find: "@/presentation", replacement: path.resolve(__dirname, "./src/presentation") },
      { find: "@/shared", replacement: path.resolve(__dirname, "./src/shared") },
      // Convenience aliases (map to presentation)
      { find: "@/components", replacement: path.resolve(__dirname, "./src/presentation/components") },
      { find: "@/contexts", replacement: path.resolve(__dirname, "./src/presentation/contexts") },
      { find: "@/hooks", replacement: path.resolve(__dirname, "./src/presentation/hooks") },
      { find: "@/utils", replacement: path.resolve(__dirname, "./src/presentation/utils") },
      { find: "@/lib", replacement: path.resolve(__dirname, "./src/presentation/lib") },
      { find: "@/constants", replacement: path.resolve(__dirname, "./src/presentation/constants") },
      // Shared aliases
      { find: "@/types", replacement: path.resolve(__dirname, "./src/shared/types") },
      { find: "@/assets", replacement: path.resolve(__dirname, "./src/shared/assets") },
      // Website pages
      { find: "@/pages", replacement: path.resolve(__dirname, "./src/website/pages") },
      // Base path (must come last)
      { find: "@", replacement: path.resolve(__dirname, "./src") },
    ],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-select'],
          calendar: ['@fullcalendar/core', '@fullcalendar/daygrid', '@fullcalendar/react', '@fullcalendar/timegrid', '@fullcalendar/interaction'],
          charts: ['recharts']
        }
      }
    }
  }
}));
