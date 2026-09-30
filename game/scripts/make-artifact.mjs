// Turns dist/index.html into dist/artifact.html for publishing as a claude.ai
// Artifact, whose host supplies its own <!doctype>/<html>/<head>/<body>
// wrapper: strips those tags and keeps everything inside them.
import fs from 'node:fs';

const html = fs.readFileSync('dist/index.html', 'utf8');
const out = html
  .replace(/<!doctype html>/i, '')
  .replace(/<\/?html[^>]*>/gi, '')
  .replace(/<\/?head>/gi, '')
  .replace(/<\/?body>/gi, '')
  .replace(/<meta charset="UTF-8">\s*/i, '')
  .replace(/<meta name="viewport"[^>]*>\s*/i, '')
  .trim();
fs.writeFileSync('dist/artifact.html', out + '\n');
console.log(`dist/artifact.html (${(out.length / 1e6).toFixed(1)} MB)`);
