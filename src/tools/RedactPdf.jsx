import { useState, useCallback, useRef } from 'react';
import { PDFDocument } from 'pdf-lib';
import usePdfTool from './shared/usePdfTool';
import { loadPdfjsDoc, renderPageToCanvas } from './shared/pdfjs';
import { Dropzone, FileInfo, ProgressBar, ActionRow } from './shared/PdfToolUI';

export default function RedactPdf() {
  const {
    file, setFile, processing, setProcessing, progress, setProgress,
    dragOver, inputRef, dropzoneProps, reset, exportPdfBytes, hasFile,
  } = usePdfTool();

  const [pages, setPages] = useState([]); // [{ thumb, w, h }]
  const [pageIdx, setPageIdx] = useState(0);
  const [boxes, setBoxes] = useState({}); // { [pageIdx]: [{x,y,w,h}] normalized }
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const areaRef = useRef(null);
  const drag = useRef(null);
  const [draft, setDraft] = useState(null); // live rectangle while dragging

  const loadFile = useCallback(async (f) => {
    if (!f || f.type !== 'application/pdf') return;
    setFile(f);
    setLoading(true);
    setPages([]);
    setBoxes({});
    try {
      const doc = await loadPdfjsDoc(await f.arrayBuffer());
      const out = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const base = page.getViewport({ scale: 1 });
        const scale = Math.min(1, 560 / base.width);
        const { canvas, width, height } = await renderPageToCanvas(page, scale, { background: '#fff' });
        out.push({ thumb: canvas.toDataURL(), w: width, h: height });
      }
      setPages(out);
      setPageIdx(0);
    } catch (err) {
      alert('Error loading: ' + err.message);
      reset();
    } finally {
      setLoading(false);
    }
  }, [setFile, reset]);

  const customDropzoneProps = {
    ...dropzoneProps,
    onDrop: (e) => { e.preventDefault(); loadFile(e.dataTransfer.files[0]); },
  };

  const onInputChange = useCallback((e) => {
    loadFile(e.target.files[0]);
    e.target.value = '';
  }, [loadFile]);

  const relPoint = useCallback((e) => {
    const rect = areaRef.current.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    };
  }, []);

  const onDown = useCallback((e) => {
    e.preventDefault();
    drag.current = relPoint(e);
    setDraft({ x: drag.current.x, y: drag.current.y, w: 0, h: 0 });
  }, [relPoint]);

  const onMove = useCallback((e) => {
    if (!drag.current) return;
    const p = relPoint(e);
    setDraft({
      x: Math.min(drag.current.x, p.x),
      y: Math.min(drag.current.y, p.y),
      w: Math.abs(p.x - drag.current.x),
      h: Math.abs(p.y - drag.current.y),
    });
  }, [relPoint]);

  const onUp = useCallback(() => {
    if (draft && draft.w > 0.01 && draft.h > 0.01) {
      setBoxes(prev => ({ ...prev, [pageIdx]: [...(prev[pageIdx] || []), draft] }));
    }
    drag.current = null;
    setDraft(null);
  }, [draft, pageIdx]);

  const removeBox = useCallback((i) => {
    setBoxes(prev => ({ ...prev, [pageIdx]: prev[pageIdx].filter((_, idx) => idx !== i) }));
  }, [pageIdx]);

  const handleReset = useCallback(() => {
    reset();
    setPages([]);
    setBoxes({});
    setStatusMsg('');
  }, [reset]);

  const totalBoxes = Object.values(boxes).reduce((n, arr) => n + arr.length, 0);

  const apply = useCallback(async () => {
    if (!file || totalBoxes === 0) return;
    setProcessing(true);
    setProgress(0);
    setStatusMsg('Applying redactions...');
    try {
      const srcBytes = new Uint8Array(await file.arrayBuffer());
      const srcDoc = await PDFDocument.load(srcBytes);
      const pdfjsDoc = await loadPdfjsDoc(srcBytes.slice());
      const out = await PDFDocument.create();
      const count = srcDoc.getPageCount();

      for (let i = 0; i < count; i++) {
        const pageBoxes = boxes[i];
        if (pageBoxes && pageBoxes.length) {
          // Rasterize this page so redacted content is physically removed.
          const page = await pdfjsDoc.getPage(i + 1);
          const { canvas } = await renderPageToCanvas(page, 150 / 72, { background: '#fff' });
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#000';
          for (const b of pageBoxes) {
            ctx.fillRect(b.x * canvas.width, b.y * canvas.height, b.w * canvas.width, b.h * canvas.height);
          }
          const jpg = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.9));
          const img = await out.embedJpg(await jpg.arrayBuffer());
          const { width, height } = srcDoc.getPage(i).getSize();
          out.addPage([width, height]).drawImage(img, { x: 0, y: 0, width, height });
        } else {
          // Untouched page — copy the original vector content across.
          const [copied] = await out.copyPages(srcDoc, [i]);
          out.addPage(copied);
        }
        setProgress(Math.round(((i + 1) / count) * 100));
      }

      exportPdfBytes(await out.save(), 'redacted.pdf');
      handleReset();
    } catch (err) {
      alert('Error: ' + err.message);
      setStatusMsg('');
      setProcessing(false);
    }
  }, [file, boxes, totalBoxes, setProcessing, setProgress, exportPdfBytes, handleReset]);

  const preview = pages[pageIdx];
  const pageBoxes = boxes[pageIdx] || [];

  return (
    <div>
      {!hasFile ? (
        <Dropzone
          dragOver={dragOver}
          dropzoneProps={customDropzoneProps}
          inputRef={inputRef}
          onInputChange={onInputChange}
          icon={'🚫'}
        />
      ) : loading ? (
        <div className="progress-text">Loading pages...</div>
      ) : (
        <>
          <FileInfo file={file} pageCount={pages.length} onRemove={handleReset} />

          <div className="controls">
            <h3>Drag over anything you want permanently removed</h3>
            <div className="control-row">
              <span className="control-label">Page</span>
              <select className="control-select" value={pageIdx} onChange={e => setPageIdx(Number(e.target.value))}>
                {pages.map((_, i) => (
                  <option key={i} value={i}>
                    Page {i + 1}{boxes[i]?.length ? ` (${boxes[i].length} redaction${boxes[i].length > 1 ? 's' : ''})` : ''}
                  </option>
                ))}
              </select>
              <span className="control-label" style={{ marginLeft: 'auto', opacity: 0.7 }}>
                {totalBoxes} redaction{totalBoxes !== 1 ? 's' : ''} total
              </span>
            </div>
          </div>

          {preview && (
            <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
              <div
                ref={areaRef}
                onPointerDown={onDown}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerLeave={onUp}
                style={{
                  position: 'relative', display: 'inline-block', cursor: 'crosshair',
                  lineHeight: 0, borderRadius: 4, border: '2px solid var(--sketch-text)',
                  touchAction: 'none', userSelect: 'none',
                }}
              >
                <img src={preview.thumb} alt={`Page ${pageIdx + 1}`} draggable={false} style={{ display: 'block', width: preview.w, height: preview.h }} />
                {pageBoxes.map((b, i) => (
                  <div
                    key={i}
                    style={{
                      position: 'absolute',
                      left: `${b.x * 100}%`, top: `${b.y * 100}%`,
                      width: `${b.w * 100}%`, height: `${b.h * 100}%`,
                      background: '#000', border: '1px solid #e17055',
                    }}
                  >
                    <button
                      onPointerDown={e => e.stopPropagation()}
                      onClick={() => removeBox(i)}
                      title="Remove"
                      style={{
                        position: 'absolute', top: -10, right: -10, width: 20, height: 20,
                        borderRadius: '50%', border: 'none', background: '#e17055', color: '#fff',
                        cursor: 'pointer', fontSize: 12, lineHeight: '20px', padding: 0,
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
                {draft && (
                  <div
                    style={{
                      position: 'absolute',
                      left: `${draft.x * 100}%`, top: `${draft.y * 100}%`,
                      width: `${draft.w * 100}%`, height: `${draft.h * 100}%`,
                      background: 'rgba(0,0,0,0.6)', border: '1px dashed #e17055',
                    }}
                  />
                )}
              </div>
            </div>
          )}

          {processing && <ProgressBar progress={progress} label={statusMsg} />}

          <ActionRow>
            <button className="btn btn-primary" disabled={processing || totalBoxes === 0} onClick={apply}>
              {processing ? 'Redacting...' : 'Apply Redactions'}
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
