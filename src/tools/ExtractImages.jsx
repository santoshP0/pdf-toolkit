import { useState, useCallback } from 'react';
import { saveAs } from 'file-saver';
import usePdfTool from './shared/usePdfTool';
import { getPdfjsLib, loadPdfjsDoc, renderPageToCanvas } from './shared/pdfjs';
import { Dropzone, FileInfo, ProgressBar, ActionRow } from './shared/PdfToolUI';

/** Resolve a named image object from a page, with a timeout so we never hang. */
function getObj(store, name) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (v) => { if (!settled) { settled = true; resolve(v || null); } };
    const timer = setTimeout(() => done(null), 4000);
    try {
      const v = store.get(name);
      clearTimeout(timer);
      done(v);
    } catch {
      try { store.get(name, (v) => { clearTimeout(timer); done(v); }); }
      catch { clearTimeout(timer); done(null); }
    }
  });
}

/** Turn a decoded pdf.js image object into a PNG data URL (or null). */
function imgToDataURL(obj) {
  if (!obj || !obj.width || !obj.height) return null;
  const w = obj.width, h = obj.height;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const bitmap = obj.bitmap || (typeof ImageBitmap !== 'undefined' && obj instanceof ImageBitmap ? obj : null);

  if (bitmap) {
    ctx.drawImage(bitmap, 0, 0);
  } else if (obj.data) {
    const src = obj.data;
    const image = ctx.createImageData(w, h);
    const dst = image.data;
    if (obj.kind === 3 || src.length === w * h * 4) {
      dst.set(src.subarray(0, w * h * 4));
    } else if (obj.kind === 2 || src.length === w * h * 3) {
      for (let i = 0, j = 0; i < w * h; i++) {
        dst[j++] = src[i * 3]; dst[j++] = src[i * 3 + 1]; dst[j++] = src[i * 3 + 2]; dst[j++] = 255;
      }
    } else if (obj.kind === 1 || src.length === w * h) {
      for (let i = 0; i < w * h; i++) {
        const g = src[i]; dst[i * 4] = g; dst[i * 4 + 1] = g; dst[i * 4 + 2] = g; dst[i * 4 + 3] = 255;
      }
    } else {
      return null;
    }
    ctx.putImageData(image, 0, 0);
  } else {
    return null;
  }
  return canvas.toDataURL('image/png');
}

export default function ExtractImages() {
  const {
    file, setFile, processing, setProcessing, progress, setProgress,
    dragOver, inputRef, dropzoneProps, reset, hasFile,
  } = usePdfTool();

  const [images, setImages] = useState([]); // [{ url, w, h, page }]
  const [statusMsg, setStatusMsg] = useState('');
  const [done, setDone] = useState(false);

  const loadFile = useCallback((f) => {
    if (!f || f.type !== 'application/pdf') return;
    setFile(f);
    setImages([]);
    setDone(false);
  }, [setFile]);

  const customDropzoneProps = {
    ...dropzoneProps,
    onDrop: (e) => { e.preventDefault(); loadFile(e.dataTransfer.files[0]); },
  };

  const onInputChange = useCallback((e) => {
    loadFile(e.target.files[0]);
    e.target.value = '';
  }, [loadFile]);

  const handleReset = useCallback(() => {
    reset();
    setImages([]);
    setDone(false);
    setStatusMsg('');
  }, [reset]);

  const extract = useCallback(async () => {
    if (!file) return;
    setProcessing(true);
    setProgress(0);
    setImages([]);
    setDone(false);
    setStatusMsg('Scanning pages...');
    try {
      const pdfjsLib = await getPdfjsLib();
      const OPS = pdfjsLib.OPS;
      const doc = await loadPdfjsDoc(await file.arrayBuffer());
      const found = [];
      const seen = new Set();

      for (let p = 1; p <= doc.numPages; p++) {
        const page = await doc.getPage(p);
        // Render first so image objects get decoded and cached on the page.
        await renderPageToCanvas(page, 1);
        const opList = await page.getOperatorList();
        const names = [];
        for (let i = 0; i < opList.fnArray.length; i++) {
          const fn = opList.fnArray[i];
          if (fn === OPS.paintImageXObject || fn === OPS.paintJpegXObject) {
            const name = opList.argsArray[i][0];
            if (typeof name === 'string' && !names.includes(name)) names.push(name);
          }
        }
        for (const name of names) {
          const key = `${p}:${name}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const obj = (await getObj(page.objs, name)) || (await getObj(page.commonObjs, name));
          const url = imgToDataURL(obj);
          if (url) found.push({ url, w: obj.width, h: obj.height, page: p });
        }
        setProgress(Math.round((p / doc.numPages) * 100));
      }

      setImages(found);
      setDone(true);
      setStatusMsg('');
    } catch (err) {
      alert('Error: ' + err.message);
      setStatusMsg('');
    } finally {
      setProcessing(false);
    }
  }, [file, setProcessing, setProgress]);

  const base = file?.name?.replace(/\.pdf$/i, '') || 'image';

  const downloadOne = useCallback((img, i) => {
    saveAs(img.url, `${base}-p${img.page}-${i + 1}.png`);
  }, [base]);

  const downloadAll = useCallback(() => {
    images.forEach((img, i) => downloadOne(img, i));
  }, [images, downloadOne]);

  return (
    <div>
      {!hasFile ? (
        <Dropzone
          dragOver={dragOver}
          dropzoneProps={customDropzoneProps}
          inputRef={inputRef}
          onInputChange={onInputChange}
          icon={'📸'}
        />
      ) : (
        <>
          <FileInfo file={file} onRemove={handleReset} />

          {processing && <ProgressBar progress={progress} label={statusMsg || 'Extracting...'} />}

          <ActionRow>
            <button className="btn btn-primary" disabled={processing} onClick={extract}>
              {processing ? 'Extracting...' : 'Extract Images'}
            </button>
            {images.length > 0 && (
              <button className="btn btn-secondary" onClick={downloadAll}>
                Download all ({images.length})
              </button>
            )}
            <button className="btn btn-secondary" onClick={handleReset}>
              Choose another file
            </button>
          </ActionRow>

          {done && images.length === 0 && (
            <div className="progress-text" style={{ marginTop: '0.5rem' }}>
              No embedded images found — this PDF likely draws everything as vector graphics or text.
            </div>
          )}

          {images.length > 0 && (
            <div className="thumb-grid" style={{ marginTop: '1rem' }}>
              {images.map((img, i) => (
                <div key={i} className="thumb-card">
                  <img src={img.url} alt={`Image ${i + 1}`} />
                  <div className="thumb-label">
                    p{img.page} · {img.w}×{img.h}
                  </div>
                  <div className="thumb-actions">
                    <button className="thumb-btn" onClick={() => downloadOne(img, i)} title="Download PNG">
                      {'↓'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
