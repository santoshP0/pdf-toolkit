/**
 * Lazily import pdf.js and make sure the worker is wired up exactly once.
 * Shared by every tool that renders or reads page content, so the worker
 * URL lives in a single place.
 */
let pdfjsPromise = null;

export function getPdfjsLib() {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist').then(mod => {
      if (!mod.GlobalWorkerOptions.workerSrc) {
        mod.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${mod.version}/build/pdf.worker.min.mjs`;
      }
      return mod;
    });
  }
  return pdfjsPromise;
}

/** Load a PDF File/ArrayBuffer/Uint8Array into a pdf.js document. */
export async function loadPdfjsDoc(source) {
  const pdfjsLib = await getPdfjsLib();
  let data;
  if (source && typeof source.arrayBuffer === 'function') {
    // File or Blob — read as ArrayBuffer first.
    data = new Uint8Array(await source.arrayBuffer());
  } else if (source instanceof ArrayBuffer) {
    data = new Uint8Array(source);
  } else {
    // Already bytes (Uint8Array / typed array) — pass through directly.
    data = source;
  }
  return pdfjsLib.getDocument({ data }).promise;
}

/** Render one page to a fresh canvas at the given scale (white background). */
export async function renderPageToCanvas(page, scale, { background = null } = {}) {
  const vp = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = vp.width;
  canvas.height = vp.height;
  const ctx = canvas.getContext('2d');
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  return { canvas, width: vp.width, height: vp.height };
}
