import { useState, useCallback } from 'react';
import { PDFDocument, degrees } from 'pdf-lib';
import usePdfTool from './shared/usePdfTool';
import { loadPdfjsDoc } from './shared/pdfjs';
import { Dropzone, FileInfo, ActionRow } from './shared/PdfToolUI';

export default function RotatePdf() {
  const {
    file, setFile,
    processing, setProcessing,
    dragOver, inputRef,
    dropzoneProps,
    exportPdfBytes,
  } = usePdfTool();

  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [rotateAll, setRotateAll] = useState(90);

  const loadFile = useCallback(async (f) => {
    if (!f || f.type !== 'application/pdf') return;
    setFile(f);
    setLoading(true);
    try {
      const doc = await loadPdfjsDoc(await f.arrayBuffer());
      const pageData = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const vp = page.getViewport({ scale: 0.3 });
        const canvas = document.createElement('canvas');
        canvas.width = vp.width;
        canvas.height = vp.height;
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        pageData.push({ idx: i, thumb: canvas.toDataURL(), rotation: 0 });
      }
      setPages(pageData);
    } catch (err) {
      alert('Error loading: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [setFile]);

  const customDropzoneProps = {
    ...dropzoneProps,
    onDrop: (e) => {
      e.preventDefault();
      loadFile(e.dataTransfer.files[0]);
    },
  };

  const handleInputChange = useCallback((e) => {
    loadFile(e.target.files[0]);
    e.target.value = '';
  }, [loadFile]);

  const rotatePage = (i, deg) => {
    setPages(prev => prev.map((p, idx) => idx === i ? { ...p, rotation: (p.rotation + deg + 360) % 360 } : p));
  };

  const rotateAllPages = () => {
    setPages(prev => prev.map(p => ({ ...p, rotation: (p.rotation + rotateAll + 360) % 360 })));
  };

  const save = async () => {
    if (!file) return;
    setProcessing(true);
    try {
      const bytes = await file.arrayBuffer();
      const doc = await PDFDocument.load(bytes);
      const pdfPages = doc.getPages();
      pages.forEach((p, i) => {
        if (p.rotation !== 0) {
          const currentRotation = pdfPages[i].getRotation().angle;
          pdfPages[i].setRotation(degrees(currentRotation + p.rotation));
        }
      });
      const pdfBytes = await doc.save();
      exportPdfBytes(pdfBytes, 'rotated.pdf');
      setPages([]);
    } catch (err) {
      alert('Error saving: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setPages([]);
  };

  return (
    <div>
      {!file ? (
        <Dropzone
          dragOver={dragOver}
          dropzoneProps={customDropzoneProps}
          inputRef={inputRef}
          onInputChange={handleInputChange}
          icon={'\uD83D\uDD04'}
        />
      ) : loading ? (
        <div className="progress-text">Loading pages...</div>
      ) : (
        <>
          <FileInfo
            file={file}
            pageCount={pages.length}
            onRemove={handleReset}
          />

          <div className="controls">
            <h3>Rotate all pages</h3>
            <div className="control-row">
              <select className="control-select" value={rotateAll} onChange={e => setRotateAll(Number(e.target.value))}>
                <option value={90}>90&deg; clockwise</option>
                <option value={180}>180&deg;</option>
                <option value={270}>90&deg; counter-clockwise</option>
              </select>
              <button className="btn btn-secondary" onClick={rotateAllPages}>Apply to all</button>
            </div>
          </div>

          <div className="thumb-grid">
            {pages.map((p, i) => (
              <div key={i} className="thumb-card">
                <img
                  src={p.thumb}
                  alt={`Page ${p.idx}`}
                  style={{ transform: `rotate(${p.rotation}deg)` }}
                />
                <div className="thumb-label">
                  Page {p.idx} {p.rotation !== 0 ? `(${p.rotation}\u00B0)` : ''}
                </div>
                <div className="thumb-actions">
                  <button className="thumb-btn" onClick={() => rotatePage(i, 90)} title="Rotate 90 CW">
                    {'\u21BB'}
                  </button>
                  <button className="thumb-btn" onClick={() => rotatePage(i, -90)} title="Rotate 90 CCW">
                    {'\u21BA'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <ActionRow>
            <button className="btn btn-primary" disabled={processing} onClick={save}>
              {processing ? 'Saving...' : 'Save Rotated PDF'}
            </button>
            <button className="btn btn-secondary" onClick={handleReset}>
              Choose another file
            </button>
          </ActionRow>
        </>
      )}
    </div>
  );
}
