import { useState, useRef } from 'react';
import { PDFDocument } from 'pdf-lib';
import { saveAs } from 'file-saver';
import { formatSize } from '../App';

export default function MergePdf() {
  const [files, setFiles] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef();

  const addFiles = (newFiles) => {
    const pdfs = Array.from(newFiles).filter(f => f.type === 'application/pdf');
    setFiles(prev => [...prev, ...pdfs]);
  };

  const removeFile = (idx) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  };

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
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      saveAs(blob, 'merged.pdf');
    } catch (err) {
      alert('Error merging: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div>
      <div
        className={`dropzone${dragOver ? ' dragover' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <div className="dropzone-icon">{'📄'}</div>
        <div className="dropzone-text">
          <strong>Drop PDF files here</strong> or click to browse
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          multiple
          hidden
          onChange={e => { addFiles(e.target.files); e.target.value = ''; }}
        />
      </div>

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
        <>
          <div className="progress-text">Merging... {progress}%</div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </>
      )}

      <div className="action-row">
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
      </div>
    </div>
  );
}
