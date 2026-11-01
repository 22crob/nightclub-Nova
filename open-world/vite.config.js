import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build` makes one self-contained dist/index.html that plays when
// opened straight from disk, and is what gets published as the play link.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: {
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    chunkSizeWarningLimit: 10000,
  },
});
