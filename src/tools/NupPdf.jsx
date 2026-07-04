import { useState, useCallback } from 'react';
import { PDFDocument } from 'pdf-lib';
import usePdfTool from './shared/usePdfTool';
import { Dropzone, FileInfo, ActionRow } from './shared/PdfToolUI';

// pages-per-sheet → [cols, rows]
const LAYOUTS = {
  2: [2, 1],
  4: [2, 2],
  6: [3, 2],
  8: [4, 2],
  9: [3, 3],
  16: [4, 4],
};

const A4 = { portrait: [595.28, 841.89], landscape: [841.89, 595.28] };

export default function NupPdf() {
  const {
    file, pageCount, processing, setProcessing,
    dragOver, inputRef, dropzoneProps, onInputChange, reset, exportPdfBytes, hasFile,
  } = usePdfTool();

  const [perSheet, setPerSheet] = useState(2);
  const [orientation, setOrientation] = useState('landscape');
  const [gap, setGap] = useState(10);

  const build = useCallback(async () => {
    if (!file) return;
    setProcessing(true);
    try {
      const src = await PDFDocument.load(await file.arrayBuffer());
      const out = await PDFDocument.create();
      const [cols, rows] = LAYOUTS[perSheet];
      const [sheetW, sheetH] = A4[orientation];
      const total = src.getPageCount();
      const indices = src.getPageIndices();
      const embedded = await out.embedPages(src.getPages());

      const margin = 20;
      const cellW = (sheetW - margin * 2 - gap * (cols - 1)) / cols;
      const cellH = (sheetH - margin * 2 - gap * (rows - 1)) / rows;

      for (let start = 0; start < total; start += perSheet) {
        const sheet = out.addPage([sheetW, sheetH]);
        for (let slot = 0; slot < perSheet && start + slot < total; slot++) {
          const emb = embedded[indices[start + slot]];
          const col = slot % cols;
          const row = Math.floor(slot / cols);
          const scale = Math.min(cellW / emb.width, cellH / emb.height);
          const w = emb.width * scale;
          const h = emb.height * scale;
          const cellX = margin + col * (cellW + gap);
          // Fill rows top-to-bottom, so invert row for PDF's bottom-left origin.
          const cellY = sheetH - margin - (row + 1) * cellH - row * gap;
          sheet.drawPage(emb, {
            x: cellX + (cellW - w) / 2,
            y: cellY + (cellH - h) / 2,
            xScale: scale,
            yScale: scale,
          });
        }
      }

      exportPdfBytes(await out.save(), `${perSheet}-up.pdf`);
    } catch (err) {
      alert('Error: ' + err.message);
      setProcessing(false);
    }
  }, [file, perSheet, orientation, gap, setProcessing, exportPdfBytes]);

  const sheets = pageCount ? Math.ceil(pageCount / perSheet) : 0;

  return (
    <div>
      {!hasFile ? (
        <Dropzone
          dragOver={dragOver}
          dropzoneProps={dropzoneProps}
          inputRef={inputRef}
          onInputChange={onInputChange}
          icon={'🔳'}
        />
      ) : (
        <>
          <FileInfo file={file} pageCount={pageCount} onRemove={reset} />

          <div className="controls">
            <h3>Layout</h3>
            <div className="control-row">
              <span className="control-label">Pages per sheet</span>
              <select className="control-select" value={perSheet} onChange={e => setPerSheet(Number(e.target.value))}>
                {Object.keys(LAYOUTS).map(n => (
                  <option key={n} value={n}>{n} per sheet</option>
                ))}
              </select>
            </div>
            <div className="control-row">
              <span className="control-label">Sheet orientation</span>
              <select className="control-select" value={orientation} onChange={e => setOrientation(e.target.value)}>
                <option value="landscape">Landscape (A4)</option>
                <option value="portrait">Portrait (A4)</option>
              </select>
            </div>
            <div className="control-row">
              <span className="control-label">Gap</span>
              <input
                className="control-input" type="number" min={0} max={60}
                value={gap} onChange={e => setGap(Number(e.target.value))}
                style={{ width: 70 }}
              />
            </div>
            {sheets > 0 && (
              <div className="control-row">
                <span className="control-label" style={{ opacity: 0.7 }}>
                  → {pageCount} pages become {sheets} sheet{sheets > 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>

          <ActionRow>
            <button className="btn btn-primary" disabled={processing} onClick={build}>
              {processing ? 'Building...' : 'Combine Pages'}
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
