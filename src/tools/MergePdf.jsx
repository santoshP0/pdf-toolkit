import { useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import { formatSize } from './shared/format';
import usePdfTool from './shared/usePdfTool';
import { Dropzone, ProgressBar, ActionRow } from './shared/PdfToolUI';

export default function MergePdf() {
  const {
    file: files, setFile: setFiles,
    processing, setProcessing,
    progress, setProgress,
    dragOver, inputRef,
    dropzoneProps, onInputChange,
    exportPdfBytes,
  } = usePdfTool({ multi: true });

  const [dragIdx, setDragIdx] = useState(null);

  /* ── Reorder drag handlers ── */
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

  const removeFile = (idx) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  };

  /* ── Merge ── */
  const merge = async () => {
    if (files.length < 2) return;
    setProcessing(true);
    setProgress(0);
    try {
      const merged = await PDFDocument.create();
      for (let i = 0; i < files.length; i++) {
        const bytes = await files[i].arrayBuffer();
        const doc = await PDFDocument.load(bytes);
        const pages = await merged.copyPages(doc, doc.getPageIndices());
        pages.forEach(p => merged.addPage(p));
        setProgress(Math.round(((i + 1) / files.length) * 100));
      }
      const pdfBytes = await merged.save();
      exportPdfBytes(pdfBytes, 'merged.pdf');
    } catch (err) {
      alert('Error merging: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div>
      <Dropzone
        dragOver={dragOver}
        dropzoneProps={dropzoneProps}
        inputRef={inputRef}
        onInputChange={onInputChange}
        icon={'\uD83D\uDCC4'}
        label="Drop PDF files here"
        multi
      />

      {files.length > 0 && (
        <div className="file-list">
          {files.map((f, i) => (
            <div
              key={i}
              className="file-item"
              draggable
              onDragStart={e => handleDragStart(e, i)}
              onDragOver={e => handleDragOverItem(e, i)}
              onDragEnd={() => setDragIdx(null)}
            >
              <span className="drag-handle">{'\u2630'}</span>
              <span className="file-name">{f.name}</span>
              <span className="file-size">{formatSize(f.size)}</span>
              <button className="file-remove" onClick={() => removeFile(i)}>{'\u00D7'}</button>
            </div>
          ))}
        </div>
      )}

      {processing && (
        <ProgressBar progress={progress} label="Merging..." />
      )}

      <ActionRow>
        <button
          className="btn btn-primary"
          disabled={files.length < 2 || processing}
          onClick={merge}
        >
          {processing ? 'Merging...' : `Merge ${files.length} files`}
        </button>
        {files.length > 0 && (
          <button className="btn btn-secondary" onClick={() => setFiles([])}>
            Clear all
          </button>
        )}
      </ActionRow>
    </div>
  );
}
