import { access, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../dist');
for (const file of [
  'index.html', '_headers', 'qpdf/qpdf.mjs', 'qpdf/qpdf.wasm',
  'runtime/ocr/worker.min.js', 'runtime/ocr/tesseract-core-lstm.wasm.js',
  'runtime/ocr/tesseract-core-lstm.wasm', 'runtime/ocr/eng.traineddata.gz',
  'runtime/pdfjs/cmaps', 'runtime/pdfjs/standard_fonts', 'runtime/pdfjs/wasm',
]) await access(path.join(root, file));

let count = 0;
async function inspect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) await inspect(target);
    else {
      count += 1;
      if ((await stat(target)).size > 25 * 1024 * 1024) {
        throw new Error(`Cloudflare Pages file limit exceeded: ${path.relative(root, target)}`);
      }
    }
  }
}
await inspect(root);
if (count > 20000) throw new Error(`Cloudflare Pages file count exceeded: ${count}`);
const assets = await readdir(path.join(root, 'assets'));
if (!assets.some(file => /^pdf\.worker.*\.mjs$/.test(file))) throw new Error('Local PDF worker is missing');
console.log(`Verified ${count} production assets, including local PDF/OCR runtimes and Pages headers.`);
