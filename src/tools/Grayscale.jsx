import { useState, useCallback } from 'react';
import { PDFDocument } from 'pdf-lib';
import usePdfTool from './shared/usePdfTool';
import { loadPdfjsDoc, renderPageToCanvas } from './shared/pdfjs';
import { Dropzone, FileInfo, ProgressBar, ActionRow } from './shared/PdfToolUI';

function toGray(canvas) {
  const ctx = canvas.getContext('2d');
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    // Luma (Rec. 601) — matches perceived brightness.
    const g = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0;
    d[i] = d[i + 1] = d[i + 2] = g;
  }
  ctx.putImageData(img, 0, 0);
}

export default function Grayscale() {
  const {
    file, pageCount, processing, setProcessing, progress, setProgress,
    dragOver, inputRef, dropzoneProps, onInputChange, reset, exportPdfBytes, hasFile,
  } = usePdfTool();

  const [dpi, setDpi] = useState(150);
  const [quality, setQuality] = useState(0.85);
  const [statusMsg, setStatusMsg] = useState('');

  const convert = useCallback(async () => {
    if (!file) return;
    setProcessing(true);
    setProgress(0);
    setStatusMsg('Rendering pages...');
    try {
      const src = await loadPdfjsDoc(await file.arrayBuffer());
      const out = await PDFDocument.create();
      const scale = dpi / 72;

      for (let i = 1; i <= src.numPages; i++) {
        const page = await src.getPage(i);
        const { canvas } = await renderPageToCanvas(page, scale, { background: '#ffffff' });
        toGray(canvas);

        const jpg = await new Promise(res => canvas.toBlob(res, 'image/jpeg', quality));
        const img = await out.embedJpg(await jpg.arrayBuffer());
        const unscaled = page.getViewport({ scale: 1 });
        const p = out.addPage([unscaled.width, unscaled.height]);
        p.drawImage(img, { x: 0, y: 0, width: unscaled.width, height: unscaled.height });

        setProgress(Math.round((i / src.numPages) * 100));
      }

      exportPdfBytes(await out.save(), 'grayscale.pdf');
      setStatusMsg('');
    } catch (err) {
      alert('Error: ' + err.message);
      setStatusMsg('');
      setProcessing(false);
    }
  }, [file, dpi, quality, setProcessing, setProgress, exportPdfBytes]);

  return (
    <div>
      {!hasFile ? (
        <Dropzone
          dragOver={dragOver}
          dropzoneProps={dropzoneProps}
          inputRef={inputRef}
          onInputChange={onInputChange}
          icon={'🌚'}
        />
      ) : (
        <>
          <FileInfo file={file} pageCount={pageCount} onRemove={reset} />

          <div className="controls">
            <h3>Grayscale options</h3>
            <p style={{ fontSize: 12, opacity: 0.7, margin: '0 0 0.75rem' }}>
              Pages are rasterized, so text becomes an image — great for ink-saving printing.
            </p>
            <div className="control-row">
              <span className="control-label">Resolution</span>
              <select className="control-select" value={dpi} onChange={e => setDpi(Number(e.target.value))}>
                <option value={100}>100 DPI (small)</option>
                <option value={150}>150 DPI (balanced)</option>
                <option value={200}>200 DPI (sharp)</option>
                <option value={300}>300 DPI (print)</option>
              </select>
            </div>
            <div className="control-row">
              <span className="control-label">JPEG quality</span>
              <input
                type="range" min={0.4} max={1} step={0.05}
                value={quality} onChange={e => setQuality(Number(e.target.value))}
                style={{ flex: 1 }}
              />
              <span className="control-label" style={{ width: 40, textAlign: 'right' }}>
                {Math.round(quality * 100)}%
              </span>
            </div>
          </div>

          {processing && <ProgressBar progress={progress} label={statusMsg || 'Converting...'} />}

          <ActionRow>
            <button className="btn btn-primary" disabled={processing} onClick={convert}>
              {processing ? 'Converting...' : 'Convert to Grayscale'}
            </button>
            <button className="btn btn-secondary" onClick={reset}>
              Choose another file
            </button>
          </ActionRow>
        </>
      )}
    </div>
  );
}
