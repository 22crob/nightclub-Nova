import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build` produces one self-contained dist/index.html (code and
// sprites inlined), so the game can be opened by double-clicking it or
// shared as a single file.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: {
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    chunkSizeWarningLimit: 10000,
  },
});
