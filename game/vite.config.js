import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build` produces one self-contained dist/index.html (code and
// sprites inlined), so the game can be opened by double-clicking it or
// shared as a single file.
//
// ARTIFACT=1 (npm run build:artifact) builds the copy for the play link into
// dist-artifact/ instead: only small sprites are inlined, the bigger ones
// are separate files published next to the page, which keeps the page small
// enough for public sharing.
const artifact = !!process.env.ARTIFACT;

export default defineConfig({
  base: './',
  plugins: [
    viteSingleFile(),
    // viteSingleFile inlines every asset; for the play link only small ones.
    artifact && {
      name: 'artifact-sprite-files',
      enforce: 'post',
      config(config) {
        config.build.assetsInlineLimit = 5000;
      },
    },
  ].filter(Boolean),
  build: {
    outDir: artifact ? 'dist-artifact' : 'dist',
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    chunkSizeWarningLimit: 10000,
  },
});
