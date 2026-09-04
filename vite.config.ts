import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      // perf/chunk-split : isole les gros vendors pour passer sous le seuil de 500 kB par chunk.
      // Aucun lazy-loading ici (comportement inchangé) — voir docs/specifications/perf-chunk-split.md.
      rollupOptions: {
        output: {
          manualChunks(id) {
            // Découpage applicatif (imports synchrones conservés : 0 changement de comportement).
            if (id.includes('/src/components/trial-tabs/')) {
              return 'quv-tabs';
            }
            if (id.includes('/src/components/results-subviews/')) {
              return 'quv-results';
            }
            if (id.includes('/src/components/')) {
              return 'quv-components';
            }
            if (id.includes('/src/scientific/analysis/')) {
              return 'quv-analysis';
            }
            if (id.includes('node_modules')) {
              if (id.includes('/react-dom/') || id.includes('/react/') || id.includes('/scheduler/')) {
                return 'react-vendor';
              }
              if (id.includes('/recharts/') || id.includes('/d3-') || id.includes('/victory-vendor/')) {
                return 'charts';
              }
              if (id.includes('/motion/') || id.includes('/framer-motion/')) {
                return 'motion';
              }
              if (id.includes('/lucide-react/')) {
                return 'icons';
              }
              return 'vendor';
            }
          },
        },
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
