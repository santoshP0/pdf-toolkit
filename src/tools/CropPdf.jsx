import { useState, useCallback, useMemo } from 'react';
import { PDFDocument } from 'pdf-lib';
import usePdfTool from './shared/usePdfTool';
import { loadPdfjsDoc, renderPageToCanvas } from './shared/pdfjs';
import { Dropzone, FileInfo, ActionRow } from './shared/PdfToolUI';

const SIDES = [
  { key: 'top', label: 'Top' },
  { key: 'right', label: 'Right' },
  { key: 'bottom', label: 'Bottom' },
  { key: 'left', label: 'Left' },
];

export default function CropPdf() {
  const {
    file, setFile, processing, setProcessing,
    dragOver, inputRef, dropzoneProps, reset, exportPdfBytes, hasFile,
  } = usePdfTool();

  const [preview, setPreview] = useState(null); // { thumb, w, h }
  const [margins, setMargins] = useState({ top: 5, right: 5, bottom: 5, left: 5 }); // percentages

  const loadFile = useCallback(async (f) => {
    if (!f || f.type !== 'application/pdf') return;
    setFile(f);
    setPreview(null);
    try {
      const doc = await loadPdfjsDoc(await f.arrayBuffer());
      const page = await doc.getPage(1);
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(1, 360 / base.width);
      const { canvas, width, height } = await renderPageToCanvas(page, scale, { background: '#fff' });
      setPreview({ thumb: canvas.toDataURL(), w: width, h: height });
    } catch (err) {
      alert('Error loading: ' + err.message);
      reset();
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

  const setSide = useCallback((key, value) => {
    setMargins(prev => ({ ...prev, [key]: Math.max(0, Math.min(45, value)) }));
  }, []);

  const handleReset = useCallback(() => {
    reset();
    setPreview(null);
    setMargins({ top: 5, right: 5, bottom: 5, left: 5 });
  }, [reset]);

  const overlayStyle = useMemo(() => ({
    top: `${margins.top}%`,
    right: `${margins.right}%`,
    bottom: `${margins.bottom}%`,
    left: `${margins.left}%`,
  }), [margins]);

  const noOp = margins.top + margins.right + margins.bottom + margins.left === 0;

  const save = useCallback(async () => {
    if (!file) return;
    setProcessing(true);
    try {
      const doc = await PDFDocument.load(await file.arrayBuffer());
      doc.getPages().forEach(page => {
        // Existing crop box is the visible area we crop relative to.
        const box = page.getCropBox();
        const cutL = box.width * (margins.left / 100);
        const cutR = box.width * (margins.right / 100);
        const cutT = box.height * (margins.top / 100);
        const cutB = box.height * (margins.bottom / 100);
        page.setCropBox(
          box.x + cutL,
          box.y + cutB,
          Math.max(1, box.width - cutL - cutR),
          Math.max(1, box.height - cutT - cutB),
        );
      });
      exportPdfBytes(await doc.save(), 'cropped.pdf');
      handleReset();
    } catch (err) {
      alert('Error: ' + err.message);
      setProcessing(false);
    }
  }, [file, margins, setProcessing, exportPdfBytes, handleReset]);

  return (
    <div>
      {!hasFile ? (
        <Dropzone
          dragOver={dragOver}
          dropzoneProps={customDropzoneProps}
          inputRef={inputRef}
          onInputChange={onInputChange}
          icon={'📐'}
        />
      ) : (
        <>
          <FileInfo file={file} onRemove={handleReset} />

          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {preview && (
              <div style={{ position: 'relative', flexShrink: 0, margin: '0 auto' }}>
                <img
                  src={preview.thumb}
                  alt="Page 1 preview"
                  style={{ display: 'block', width: preview.w, height: preview.h, borderRadius: 4, border: '2px solid var(--sketch-text)' }}
                />
                <div style={{
                  position: 'absolute',
                  ...overlayStyle,
                  border: '2px dashed var(--cat-edit, #6c5ce7)',
                  background: 'rgba(108, 92, 231, 0.12)',
                  pointerEvents: 'none',
                  borderRadius: 2,
                }} />
              </div>
            )}

            <div className="controls" style={{ flex: 1, minWidth: 240 }}>
              <h3>Crop margins (% of page)</h3>
              {SIDES.map(({ key, label }) => (
                <div className="control-row" key={key}>
                  <span className="control-label">{label}</span>
                  <input
                    type="range" min={0} max={45} step={0.5}
                    value={margins[key]}
                    onChange={e => setSide(key, Number(e.target.value))}
                    style={{ flex: 1 }}
                  />
                  <input
                    className="control-input" type="number" min={0} max={45} step={0.5}
                    value={margins[key]}
                    onChange={e => setSide(key, Number(e.target.value))}
                    style={{ width: 70 }}
                  />
                </div>
              ))}
            </div>
          </div>

          <ActionRow>
            <button className="btn btn-primary" disabled={processing || noOp} onClick={save}>
              {processing ? 'Cropping...' : 'Crop PDF'}
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
