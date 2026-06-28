import { useState, useRef } from 'react';
import { PDFDocument } from 'pdf-lib';
import { saveAs } from 'file-saver';
import { formatSize } from '../App';

export default function SplitPdf() {
  const [file, setFile] = useState(null);
  const [pageCount, setPageCount] = useState(0);
  const [ranges, setRanges] = useState('');
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef();

  const loadFile = async (f) => {
    if (!f || f.type !== 'application/pdf') return;
    setFile(f);
    try {
      const bytes = await f.arrayBuffer();
      const doc = await PDFDocument.load(bytes);
      const count = doc.getPageCount();
      setPageCount(count);
      setRanges(`1-${count}`);
    } catch (err) {
      alert('Error loading PDF: ' + err.message);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    loadFile(e.dataTransfer.files[0]);
  };

  const parseRanges = (str, max) => {
    const parts = str.split(',').map(s => s.trim()).filter(Boolean);
    const pages = [];
    for (const part of parts) {
      if (part.includes('-')) {
        const [a, b] = part.split('-').map(Number);
        if (isNaN(a) || isNaN(b)) continue;
        for (let i = Math.max(1, a); i <= Math.min(max, b); i++) {
          if (!pages.includes(i - 1)) pages.push(i - 1);
        }
      } else {
        const n = Number(part);
        if (!isNaN(n) && n >= 1 && n <= max && !pages.includes(n - 1)) {
          pages.push(n - 1);
        }
      }
    }
    return pages;
  };

  const split = async () => {
    if (!file) return;
    setProcessing(true);
    setProgress(0);
    try {
      const bytes = await file.arrayBuffer();
      const srcDoc = await PDFDocument.load(bytes);
      const indices = parseRanges(ranges, pageCount);
      if (indices.length === 0) {
        alert('No valid pages specified');
        setProcessing(false);
        return;
      }
      const newDoc = await PDFDocument.create();
      const copiedPages = await newDoc.copyPages(srcDoc, indices);
      copiedPages.forEach((p, i) => {
        newDoc.addPage(p);
        setProgress(Math.round(((i + 1) / copiedPages.length) * 100));
      });
      const pdfBytes = await newDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      saveAs(blob, 'split.pdf');
    } catch (err) {
      alert('Error splitting: ' + err.message);
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
          <div className="dropzone-icon">{'\u2702\uFE0F'}</div>
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
      ) : (
        <>
          <div className="file-list">
            <div className="file-item">
              <span className="file-name">{file.name}</span>
              <span className="file-size">{formatSize(file.size)} &middot; {pageCount} pages</span>
              <button className="file-remove" onClick={() => { setFile(null); setPageCount(0); }}>{'\u00D7'}</button>
            </div>
          </div>

          <div className="controls">
            <h3>Page ranges</h3>
            <div className="control-row">
              <span className="control-label">Pages</span>
              <input
                className="control-input"
                type="text"
                value={ranges}
                onChange={e => setRanges(e.target.value)}
                placeholder="e.g. 1-3, 5, 7-9"
                style={{ flex: 1 }}
              />
            </div>
            <div className="control-row">
              <span className="control-label" />
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                Use commas to separate ranges. Total pages: {pageCount}
              </span>
            </div>
          </div>

          {processing && (
            <>
              <div className="progress-text">Splitting... {progress}%</div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>
            </>
          )}

          <div className="action-row">
            <button className="btn btn-primary" disabled={processing || !ranges.trim()} onClick={split}>
              {processing ? 'Splitting...' : 'Split & Download'}
            </button>
            <button className="btn btn-secondary" onClick={() => { setFile(null); setPageCount(0); }}>
              Choose another file
            </button>
          </div>
        </>
      )}
    </div>
  );
}
