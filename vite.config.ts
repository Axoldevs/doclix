import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    // Route-level lazy() calls (App.tsx, DocProjectPage.tsx) already split
    // page/editor code into their own chunks. This adds a vendor split on
    // top: rarely-changing third-party deps land in their own chunk with
    // their own long-lived cache entry, separate from app code that
    // changes on every deploy -- so a redeploy doesn't force everyone to
    // re-download React/Radix/dnd-kit again, just the small app chunk.
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-radix': [
            '@radix-ui/react-slot',
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-label',
          ],
          'vendor-dnd': ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
          'vendor-supabase': ['@supabase/supabase-js'],
        },
      },
    },
    // Individual page/editor chunks are legitimately small now; this just
    // raises the warning threshold so it stops firing on the unavoidable
    // vendor-react chunk instead of being a signal worth acting on.
    chunkSizeWarningLimit: 600,
  },
});
