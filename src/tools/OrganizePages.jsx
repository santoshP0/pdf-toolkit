import { useState, useRef, useEffect } from 'react';
import { PDFDocument, degrees } from 'pdf-lib';
import { saveAs } from 'file-saver';
import { formatSize } from '../App';

function getPdfjsLib() {
  return import('pdfjs-dist').then(mod => {
    const pdfjsLib = mod;
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
    }
    return pdfjsLib;
  });
}

export default function OrganizePages() {
  const [file, setFile] = useState(null);
  const [pages, setPages] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [dragIdx, setDragIdx] = useState(null);
  const inputRef = useRef();

  const loadFile = async (f) => {
    if (!f || f.type !== 'application/pdf') return;
    setFile(f);
    setLoading(true);
    try {
      const pdfjsLib = await getPdfjsLib();
      const bytes = await f.arrayBuffer();
      const doc = await pdfjsLib.getDocument({ data: new Uint8Array(bytes) }).promise;
      const pageData = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const vp = page.getViewport({ scale: 0.3 });
        const canvas = document.createElement('canvas');
        canvas.width = vp.width;
        canvas.height = vp.height;
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        pageData.push({ idx: i, thumb: canvas.toDataURL(), rotation: 0, deleted: false });
      }
      setPages(pageData);
    } catch (err) {
      alert('Error loading PDF: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    loadFile(e.dataTransfer.files[0]);
  };

  const rotatePage = (i, deg) => {
    setPages(prev => prev.map((p, idx) => idx === i ? { ...p, rotation: (p.rotation + deg) % 360 } : p));
  };

  const deletePage = (i) => {
    setPages(prev => prev.map((p, idx) => idx === i ? { ...p, deleted: !p.deleted } : p));
  };

  const handleDragStart = (e, idx) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOverItem = (e, idx) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    setPages(prev => {
      const next = [...prev];
      const [item] = next.splice(dragIdx, 1);
      next.splice(idx, 0, item);
      return next;
    });
    setDragIdx(idx);
  };

  const save = async () => {
    if (!file) return;
    setProcessing(true);
    try {
      const bytes = await file.arrayBuffer();
      const srcDoc = await PDFDocument.load(bytes);
      const newDoc = await PDFDocument.create();
      const activePages = pages.filter(p => !p.deleted);
      const indices = activePages.map(p => p.idx - 1);
      const copied = await newDoc.copyPages(srcDoc, indices);
      copied.forEach((page, i) => {
        const rot = activePages[i].rotation;
        if (rot !== 0) {
          page.setRotation(degrees(rot));
        }
        newDoc.addPage(page);
      });
      const pdfBytes = await newDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      saveAs(blob, 'organized.pdf');
    } catch (err) {
      alert('Error saving: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const activeCount = pages.filter(p => !p.deleted).length;

  return (
    <div>
      {!file ? (
        <div
          className={`dropzone${dragOver ? ' dragover' : ''}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <div className="dropzone-icon">{'🗃️'}</div>
          <div className="dropzone-text">
            <strong>Drop a PDF file here</strong> or click to browse
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf"
            hidden
            onChange={e => { loadFile(e.target.files[0]); e.target.value = ''; }}
          />
        </div>
      ) : loading ? (
        <div className="progress-text">Loading pages...</div>
      ) : (
        <>
          <div className="file-list">
            <div className="file-item">
              <span className="file-name">{file.name}</span>
              <span className="file-size">{formatSize(file.size)} &middot; {pages.length} pages</span>
              <button className="file-remove" onClick={() => { setFile(null); setPages([]); }}>{'\u00D7'}</button>
            </div>
          </div>

          <div className="thumb-grid">
            {pages.map((p, i) => (
              <div
                key={i}
                className={`thumb-card${p.deleted ? ' deleted' : ''}`}
                style={{ opacity: p.deleted ? 0.35 : 1 }}
                draggable
                onDragStart={e => handleDragStart(e, i)}
                onDragOver={e => handleDragOverItem(e, i)}
                onDragEnd={() => setDragIdx(null)}
              >
                <div style={{ overflow: 'hidden', borderRadius: 2 }}>
                  <img
                    src={p.thumb}
                    alt={`Page ${p.idx}`}
                    style={{ transform: `rotate(${p.rotation}deg)`, transition: 'transform 0.2s' }}
                  />
                </div>
                <div className="thumb-label">Page {p.idx}</div>
                <div className="thumb-actions">
                  <button className="thumb-btn" onClick={() => rotatePage(i, 90)} title="Rotate 90">
                    {'\u21BB'}
                  </button>
                  <button className="thumb-btn" onClick={() => rotatePage(i, -90)} title="Rotate -90">
                    {'\u21BA'}
                  </button>
                  <button
                    className="thumb-btn danger"
                    onClick={() => deletePage(i)}
                    title={p.deleted ? 'Restore' : 'Delete'}
                  >
                    {p.deleted ? '\u21A9' : '\u2715'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="action-row">
            <button className="btn btn-primary" disabled={processing || activeCount === 0} onClick={save}>
              {processing ? 'Saving...' : `Save ${activeCount} pages`}
            </button>
            <button className="btn btn-secondary" onClick={() => { setFile(null); setPages([]); }}>
              Choose another file
            </button>
          </div>
        </>
      )}
    </div>
  );
}
