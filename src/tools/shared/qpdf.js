/**
 * Runtime bridge to the vendored qpdf WASM CLI (see /public/qpdf).
 *
 * The Emscripten glue is loaded straight from the public folder at runtime so
 * Vite never tries to bundle it. Everything runs locally in the browser — no
 * bytes ever leave the page, keeping the toolkit's privacy promise intact.
 */
const BASE = import.meta.env.BASE_URL || '/';
let factoryPromise = null;

function loadFactory() {
  if (!factoryPromise) {
    factoryPromise = import(/* @vite-ignore */ `${BASE}qpdf/qpdf.mjs`).then(m => m.default);
  }
  return factoryPromise;
}

/**
 * Run the qpdf CLI with `args`, writing `inputBytes` to `inputFile` first.
 * Returns { exitCode, logs, read } where `read(name)` pulls a file back out
 * of the virtual filesystem as a Uint8Array (or null if it wasn't produced).
 *
 * qpdf exit codes: 0 = success, 2 = errors, 3 = warnings only (still usable).
 */
export async function runQpdf(args, inputFile, inputBytes) {
  const createQpdf = await loadFactory();
  const logs = [];
  const Module = await createQpdf({
    noInitialRun: true,
    locateFile: (path) => (path.endsWith('.wasm') ? `${BASE}qpdf/qpdf.wasm` : path),
    print: (t) => logs.push(t),
    printErr: (t) => logs.push(t),
  });

  Module.FS.writeFile(inputFile, inputBytes);

  let exitCode = 0;
  try {
    const rc = Module.callMain(args);
    if (typeof rc === 'number') exitCode = rc;
  } catch (e) {
    if (e && typeof e.status === 'number') exitCode = e.status;
    else throw e;
  }

  const read = (name) => {
    try {
      return Module.FS.readFile(name);
    } catch {
      return null;
    }
  };

  return { exitCode, logs, read };
}
