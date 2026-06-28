import { useState, useRef } from 'react';
import { PDFDocument } from 'pdf-lib';
import { saveAs } from 'file-saver';
import { formatSize } from '../App';

export default function ImagesToPdf() {
  const [files, setFiles] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [dragIdx, setDragIdx] = useState(null);
  const inputRef = useRef();

  const addFiles = (newFiles) => {
    const imgs = Array.from(newFiles).filter(f => f.type.startsWith('image/'));
    const withPreviews = imgs.map(f => {
      const url = URL.createObjectURL(f);
      return { file: f, preview: url };
    });
    setFiles(prev => [...prev, ...withPreviews]);
  };

  const removeFile = (idx) => {
    setFiles(prev => {
      URL.revokeObjectURL(prev[idx].preview);
      return prev.filter((_, i) => i !== idx);
    });
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

  const convert = async () => {
    if (files.length === 0) return;
    setProcessing(true);
    setProgress(0);
    try {
      const doc = await PDFDocument.create();
      for (let i = 0; i < files.length; i++) {
        const bytes = await files[i].file.arrayBuffer();
        const type = files[i].file.type;
        let img;
        if (type === 'image/png') {
          img = await doc.embedPng(bytes);
        } else {
          img = await doc.embedJpg(bytes);
        }
        const page = doc.addPage([img.width, img.height]);
        page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
        setProgress(Math.round(((i + 1) / files.length) * 100));
      }
      const pdfBytes = await doc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      saveAs(blob, 'images.pdf');
    } catch (err) {
      alert('Error converting: ' + err.message);
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
        <div className="dropzone-icon">{'🖼️'}</div>
        <div className="dropzone-text">
          <strong>Drop images here</strong> or click to browse (JPG, PNG)
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png"
          multiple
          hidden
          onChange={e => { addFiles(e.target.files); e.target.value = ''; }}
        />
      </div>

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

      {processing && (
        <>
          <div className="progress-text">Converting... {progress}%</div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </>
      )}

      <div className="action-row">
        <button className="btn btn-primary" disabled={files.length === 0 || processing} onClick={convert}>
          {processing ? 'Converting...' : `Create PDF (${files.length} images)`}
        </button>
        {files.length > 0 && (
          <button className="btn btn-secondary" onClick={() => { files.forEach(f => URL.revokeObjectURL(f.preview)); setFiles([]); }}>
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}
