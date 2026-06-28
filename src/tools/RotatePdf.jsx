import { useState, useRef } from 'react';
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

export default function RotatePdf() {
  const [file, setFile] = useState(null);
  const [pages, setPages] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rotateAll, setRotateAll] = useState(90);
  const [dragOver, setDragOver] = useState(false);
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
        pageData.push({ idx: i, thumb: canvas.toDataURL(), rotation: 0 });
      }
      setPages(pageData);
    } catch (err) {
      alert('Error loading: ' + err.message);
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
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      saveAs(blob, 'rotated.pdf');
    } catch (err) {
      alert('Error saving: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

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
          <div className="dropzone-icon">{'🔄'}</div>
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

          <div className="controls">
            <h3>Rotate all pages</h3>
            <div className="control-row">
              <select className="control-select" value={rotateAll} onChange={e => setRotateAll(Number(e.target.value))}>
                <option value={90}>90\u00B0 clockwise</option>
                <option value={180}>180\u00B0</option>
                <option value={270}>90\u00B0 counter-clockwise</option>
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

          <div className="action-row">
            <button className="btn btn-primary" disabled={processing} onClick={save}>
              {processing ? 'Saving...' : 'Save Rotated PDF'}
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
