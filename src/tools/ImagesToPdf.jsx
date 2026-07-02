import { useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import usePdfTool from './shared/usePdfTool';
import { Dropzone, ProgressBar, ActionRow } from './shared/PdfToolUI';

export default function ImagesToPdf() {
  const {
    processing, setProcessing,
    progress, setProgress,
    dragOver, inputRef,
    dropzoneProps,
    exportPdfBytes,
  } = usePdfTool({ multi: true, acceptTypes: ['image/jpeg', 'image/png'], outputName: 'images.pdf' });

  /* ── Custom file state (stores {file, preview} objects) ── */
  const [files, setFiles] = useState([]);
  const [dragIdx, setDragIdx] = useState(null);

  const addFiles = (newFiles) => {
    const imgs = Array.from(newFiles).filter(f => f.type.startsWith('image/'));
    const withPreviews = imgs.map(f => ({
      file: f,
      preview: URL.createObjectURL(f),
    }));
    setFiles(prev => [...prev, ...withPreviews]);
  };

  const removeFile = (idx) => {
    setFiles(prev => {
      URL.revokeObjectURL(prev[idx].preview);
      return prev.filter((_, i) => i !== idx);
    });
  };

  /* ── Custom drop / input handlers (bypass hook's loadFiles) ── */
  const handleDrop = (e) => {
    e.preventDefault();
    dropzoneProps.onDragLeave();
    addFiles(e.dataTransfer.files);
  };

  const onInputChange = (e) => {
    addFiles(e.target.files);
    e.target.value = '';
  };

  /* ── Drag reorder ── */
  const handleDragStart = (e, idx) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOverItem = (e, idx) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    setFiles(prev => {
      const next = [...prev];
      const [item] = next.splice(dragIdx, 1);
      next.splice(idx, 0, item);
      return next;
    });
    setDragIdx(idx);
  };

  /* ── Convert ── */
  const convert = async () => {
    if (files.length === 0) return;
    setProcessing(true);
    setProgress(0);
    try {
      const doc = await PDFDocument.create();
      for (let i = 0; i < files.length; i++) {
        const bytes = await files[i].file.arrayBuffer();
        const type = files[i].file.type;
        const img = type === 'image/png'
          ? await doc.embedPng(bytes)
          : await doc.embedJpg(bytes);
        const page = doc.addPage([img.width, img.height]);
        page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
        setProgress(Math.round(((i + 1) / files.length) * 100));
      }
      const pdfBytes = await doc.save();
      exportPdfBytes(pdfBytes, 'images.pdf');
      files.forEach(f => URL.revokeObjectURL(f.preview));
      setFiles([]);
    } catch (err) {
      alert('Error converting: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const clearAll = () => {
    files.forEach(f => URL.revokeObjectURL(f.preview));
    setFiles([]);
  };

  return (
    <div>
      <Dropzone
        dragOver={dragOver}
        dropzoneProps={{ ...dropzoneProps, onDrop: handleDrop }}
        inputRef={inputRef}
        onInputChange={onInputChange}
        icon={'\uD83D\uDDBC\uFE0F'}
        label="Drop images here"
        accept="image/jpeg,image/png"
        multi
      />

      {files.length > 0 && (
        <div className="thumb-grid">
          {files.map((f, i) => (
            <div
              key={i}
              className="thumb-card"
              draggable
              onDragStart={e => handleDragStart(e, i)}
              onDragOver={e => handleDragOverItem(e, i)}
              onDragEnd={() => setDragIdx(null)}
            >
              <img src={f.preview} alt={f.file.name} style={{ maxHeight: 160, objectFit: 'contain' }} />
              <div className="thumb-label">{f.file.name}</div>
              <div className="thumb-actions">
                <button className="thumb-btn danger" onClick={() => removeFile(i)}>{'\u2715'}</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {processing && <ProgressBar progress={progress} label="Converting..." />}

      <ActionRow>
        <button className="btn btn-primary" disabled={files.length === 0 || processing} onClick={convert}>
          {processing ? 'Converting...' : `Create PDF (${files.length} images)`}
        </button>
        {files.length > 0 && (
          <button className="btn btn-secondary" onClick={clearAll}>
            Clear all
          </button>
        )}
      </ActionRow>
    </div>
  );
}
