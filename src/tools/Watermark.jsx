import { useState, useRef } from 'react';
import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import { saveAs } from 'file-saver';
import { formatSize } from '../App';

export default function Watermark() {
  const [file, setFile] = useState(null);
  const [pageCount, setPageCount] = useState(0);
  const [text, setText] = useState('CONFIDENTIAL');
  const [opacity, setOpacity] = useState(0.15);
  const [angle, setAngle] = useState(-45);
  const [fontSize, setFontSize] = useState(60);
  const [processing, setProcessing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef();

  const loadFile = async (f) => {
    if (!f || f.type !== 'application/pdf') return;
    setFile(f);
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

  const stamp = async () => {
    if (!file || !text.trim()) return;
    setProcessing(true);
    try {
      const bytes = await file.arrayBuffer();
      const doc = await PDFDocument.load(bytes);
      const font = await doc.embedFont(StandardFonts.HelveticaBold);
      const pages = doc.getPages();

      pages.forEach(page => {
        const { width, height } = page.getSize();
        const textWidth = font.widthOfTextAtSize(text, fontSize);
        const x = (width - textWidth) / 2;
        const y = height / 2;

        page.drawText(text, {
          x,
          y,
          size: fontSize,
          font,
          color: rgb(0.5, 0.5, 0.5),
          opacity,
          rotate: degrees(-angle),
        });
      });

      const pdfBytes = await doc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      saveAs(blob, 'watermarked.pdf');
    } catch (err) {
      alert('Error: ' + err.message);
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
          <div className="dropzone-icon">{'💧'}</div>
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
            <h3>Watermark settings</h3>
            <div className="control-row">
              <span className="control-label">Text</span>
              <input
                className="control-input"
                type="text"
                value={text}
                onChange={e => setText(e.target.value)}
                style={{ flex: 1 }}
              />
            </div>
            <div className="control-row">
              <span className="control-label">Font size</span>
              <input
                className="control-input"
                type="number"
                min={10}
                max={200}
                value={fontSize}
                onChange={e => setFontSize(Number(e.target.value))}
                style={{ width: 70 }}
              />
            </div>
            <div className="control-row">
              <span className="control-label">Opacity</span>
              <input
                type="range"
                min={0.05}
                max={0.8}
                step={0.05}
                value={opacity}
                onChange={e => setOpacity(Number(e.target.value))}
                style={{ flex: 1, maxWidth: 200 }}
              />
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {Math.round(opacity * 100)}%
              </span>
            </div>
            <div className="control-row">
              <span className="control-label">Angle</span>
              <input
                className="control-input"
                type="number"
                min={-90}
                max={90}
                value={angle}
                onChange={e => setAngle(Number(e.target.value))}
                style={{ width: 70 }}
              />
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                degrees
              </span>
            </div>
          </div>

          <div style={{
            textAlign: 'center',
            padding: '2rem',
            background: 'var(--surface)',
            border: '2px solid var(--sketch-text)',
            borderRadius: 4,
            marginBottom: '1.5rem',
            position: 'relative',
            overflow: 'hidden',
            minHeight: 160,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <div style={{
              fontFamily: "var(--font-hand)",
              fontSize: `${Math.min(fontSize * 0.5, 40)}px`,
              fontWeight: 700,
              color: `rgba(128, 128, 128, ${opacity})`,
              transform: `rotate(${angle}deg)`,
              whiteSpace: 'nowrap',
              userSelect: 'none',
            }}>
              {text || 'WATERMARK'}
            </div>
            <div style={{
              position: 'absolute',
              bottom: 8,
              right: 12,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.65rem',
              color: 'var(--text-muted)',
            }}>preview</div>
          </div>

          <div className="action-row">
            <button className="btn btn-primary" disabled={processing || !text.trim()} onClick={stamp}>
              {processing ? 'Processing...' : 'Add Watermark'}
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
