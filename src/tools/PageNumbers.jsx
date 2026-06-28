import { useState, useRef } from 'react';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { saveAs } from 'file-saver';
import { formatSize } from '../App';

export default function PageNumbers() {
  const [file, setFile] = useState(null);
  const [pageCount, setPageCount] = useState(0);
  const [position, setPosition] = useState('bottom-center');
  const [fontSize, setFontSize] = useState(12);
  const [startNum, setStartNum] = useState(1);
  const [format, setFormat] = useState('plain');
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
    if (!file) return;
    setProcessing(true);
    try {
      const bytes = await file.arrayBuffer();
      const doc = await PDFDocument.load(bytes);
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const pages = doc.getPages();
      const [vPos, hPos] = position.split('-');

      pages.forEach((page, i) => {
        const num = startNum + i;
        let label = String(num);
        if (format === 'dash') label = `- ${num} -`;
        else if (format === 'of') label = `${num} of ${pages.length + startNum - 1}`;
        else if (format === 'page') label = `Page ${num}`;

        const { width, height } = page.getSize();
        const textWidth = font.widthOfTextAtSize(label, fontSize);

        let x, y;
        if (hPos === 'left') x = 40;
        else if (hPos === 'right') x = width - textWidth - 40;
        else x = (width - textWidth) / 2;

        if (vPos === 'top') y = height - 40;
        else y = 30;

        page.drawText(label, { x, y, size: fontSize, font, color: rgb(0.3, 0.3, 0.3) });
      });

      const pdfBytes = await doc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      saveAs(blob, 'numbered.pdf');
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
          <div className="dropzone-icon">{'#\uFE0F\u20E3'}</div>
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
            <h3>Number settings</h3>
            <div className="control-row">
              <span className="control-label">Position</span>
              <select className="control-select" value={position} onChange={e => setPosition(e.target.value)}>
                <option value="bottom-left">Bottom Left</option>
                <option value="bottom-center">Bottom Center</option>
                <option value="bottom-right">Bottom Right</option>
                <option value="top-left">Top Left</option>
                <option value="top-center">Top Center</option>
                <option value="top-right">Top Right</option>
              </select>
            </div>
            <div className="control-row">
              <span className="control-label">Font size</span>
              <input
                className="control-input"
                type="number"
                min={6}
                max={36}
                value={fontSize}
                onChange={e => setFontSize(Number(e.target.value))}
                style={{ width: 70 }}
              />
            </div>
            <div className="control-row">
              <span className="control-label">Start at</span>
              <input
                className="control-input"
                type="number"
                min={0}
                value={startNum}
                onChange={e => setStartNum(Number(e.target.value))}
                style={{ width: 70 }}
              />
            </div>
            <div className="control-row">
              <span className="control-label">Format</span>
              <select className="control-select" value={format} onChange={e => setFormat(e.target.value)}>
                <option value="plain">1, 2, 3...</option>
                <option value="dash">- 1 -, - 2 -...</option>
                <option value="of">1 of N</option>
                <option value="page">Page 1, Page 2...</option>
              </select>
            </div>
          </div>

          <div className="action-row">
            <button className="btn btn-primary" disabled={processing} onClick={stamp}>
              {processing ? 'Processing...' : 'Add Page Numbers'}
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
