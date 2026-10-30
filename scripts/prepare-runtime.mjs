import { copyFile, cp, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');
const output = path.join(root, 'public/runtime/ocr');
await mkdir(output, { recursive: true });
const packageRoot = name => path.dirname(require.resolve(`${name}/package.json`));
await copyFile(path.join(packageRoot('tesseract.js'), 'dist/worker.min.js'), path.join(output, 'worker.min.js'));
await copyFile(path.join(packageRoot('tesseract.js'), 'LICENSE.md'), path.join(output, 'TESSERACT-LICENSE.md'));
// The LSTM core supports the English model and works across WASM-capable
// browsers without loading a different core from a CDN.
for (const file of ['tesseract-core-lstm.wasm.js', 'tesseract-core-lstm.wasm']) {
  await copyFile(path.join(packageRoot('tesseract.js-core'), file), path.join(output, file));
}
await copyFile(
  path.join(packageRoot('@tesseract.js-data/eng'), '4.0.0_best_int/eng.traineddata.gz'),
  path.join(output, 'eng.traineddata.gz'),
);
console.log('Prepared local OCR runtime.');
for (const directory of ['cmaps', 'standard_fonts', 'wasm', 'iccs']) {
  await cp(path.join(packageRoot('pdfjs-dist'), directory),
    path.join(root, 'public/runtime/pdfjs', directory), { recursive: true });
}
console.log('Prepared local PDF fonts and image decoders.');
const licenses = path.join(root, 'public/runtime/licenses');
await mkdir(licenses, { recursive: true });
for (const [name, file] of [
  ['pdfjs-dist', 'LICENSE'], ['tesseract.js-core', 'LICENSE'],
  ['@fontsource/architects-daughter', 'LICENSE'],
  ['@fontsource-variable/space-grotesk', 'LICENSE'],
  ['@fontsource-variable/jetbrains-mono', 'LICENSE'],
]) {
  await copyFile(path.join(packageRoot(name), file), path.join(licenses, `${name.replaceAll('/', '-')}.txt`));
}
