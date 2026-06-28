import { useState, useRef } from 'react';
import { PDFDocument } from 'pdf-lib';
import { saveAs } from 'file-saver';
import { formatSize } from '../App';

export default function CompressPdf() {
  const [file, setFile] = useState(null);
  const [pageCount, setPageCount] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef();

  const loadFile = async (f) => {
    if (!f || f.type !== 'application/pdf') return;
    setFile(f);
    setResult(null);
    try {
      const bytes = await f.arrayBuffer();
      const doc = await PDFDocument.load(bytes);
      setPageCount(doc.getPageCount());
    } catch (err) {
      alert('Error loading: ' + err.message);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    loadFile(e.dataTransfer.files[0]);
  };

  const compress = async () => {
    if (!file) return;
    setProcessing(true);
    setProgress(0);
    setResult(null);
    try {
      const bytes = await file.arrayBuffer();
      const srcDoc = await PDFDocument.load(bytes);
      const newDoc = await PDFDocument.create();
      const totalPages = srcDoc.getPageCount();

      const indices = srcDoc.getPageIndices();
      const copiedPages = await newDoc.copyPages(srcDoc, indices);
      copiedPages.forEach((page, i) => {
        newDoc.addPage(page);
        setProgress(Math.round(((i + 1) / totalPages) * 100));
      });

      // Copy metadata
      const srcTitle = srcDoc.getTitle();
      const srcAuthor = srcDoc.getAuthor();
      const srcSubject = srcDoc.getSubject();
      if (srcTitle) newDoc.setTitle(srcTitle);
      if (srcAuthor) newDoc.setAuthor(srcAuthor);
      if (srcSubject) newDoc.setSubject(srcSubject);

      const pdfBytes = await newDoc.save();
      const originalSize = file.size;
      const newSize = pdfBytes.length;
      const saved = originalSize - newSize;
      const pct = originalSize > 0 ? ((saved / originalSize) * 100).toFixed(1) : 0;

      setResult({
        bytes: pdfBytes,
        originalSize,
        newSize,
        saved,
        pct: Number(pct),
      });
    } catch (err) {
      alert('Error compressing: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const download = () => {
    if (!result) return;
    const blob = new Blob([result.bytes], { type: 'application/pdf' });
    saveAs(blob, 'compressed.pdf');
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
          <div className="dropzone-icon">{'🗜️'}</div>
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
              <button className="file-remove" onClick={() => { setFile(null); setPageCount(0); setResult(null); }}>{'\u00D7'}</button>
            </div>
          </div>

          {processing && (
            <>
              <div className="progress-text">Compressing... {progress}%</div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>
            </>
          )}

          {result && (
            <div className="result-area">
              <h3>Compression result</h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: '1rem',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.8rem',
                textAlign: 'center',
                padding: '0.75rem 0'
              }}>
                <div>
                  <div style={{ color: 'var(--ink-soft)', marginBottom: '0.25rem' }}>Original</div>
                  <div style={{ fontWeight: 600 }}>{formatSize(result.originalSize)}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--ink-soft)', marginBottom: '0.25rem' }}>Compressed</div>
                  <div style={{ fontWeight: 600 }}>{formatSize(result.newSize)}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--ink-soft)', marginBottom: '0.25rem' }}>Saved</div>
                  <div style={{ fontWeight: 600, color: result.saved > 0 ? '#5cb85c' : 'var(--ink-soft)' }}>
                    {result.saved > 0 ? `-${result.pct}%` : 'No reduction'}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="action-row" style={{ marginTop: result ? '1rem' : 0 }}>
            {!result ? (
              <button className="btn btn-primary" disabled={processing} onClick={compress}>
                {processing ? 'Compressing...' : 'Compress PDF'}
              </button>
            ) : (
              <button className="btn btn-primary" onClick={download}>
                Download compressed PDF
              </button>
            )}
            <button className="btn btn-secondary" onClick={() => { setFile(null); setPageCount(0); setResult(null); }}>
              Choose another file
            </button>
          </div>
        </>
      )}
    </div>
  );
}
