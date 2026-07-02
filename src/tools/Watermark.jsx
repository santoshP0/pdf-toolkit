import { useState, useRef, useEffect, useCallback } from 'react';
import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import { saveAs } from 'file-saver';
import { formatSize } from '../App';
import * as pdfjsLib from 'pdfjs-dist';

export default function Watermark() {
  const [file, setFile] = useState(null);
  const [pdfBytes, setPdfBytes] = useState(null);
  const [pageCount, setPageCount] = useState(0);

  /* Mode: 'text' or 'image' */
  const [mode, setMode] = useState('text');

  /* Text settings */
  const [text, setText] = useState('CONFIDENTIAL');
  const [fontSize, setFontSize] = useState(60);

  /* Image settings */
  const [wmImage, setWmImage] = useState(null); // { dataUrl, name, width, height }
  const [imageScale, setImageScale] = useState(30); // % of page width

  /* Shared settings */
  const [opacity, setOpacity] = useState(0.15);
  const [angle, setAngle] = useState(-45);
  const [color, setColor] = useState('#808080');

  /* Position as % of page (0-100), default center */
  const [posX, setPosX] = useState(50);
  const [posY, setPosY] = useState(50);

  /* Preview */
  const [previewUrl, setPreviewUrl] = useState(null);
  const previewRef = useRef(null);
  const previewContainerRef = useRef(null);
  const [previewSize, setPreviewSize] = useState({ width: 0, height: 0 });

  /* Drag state */
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef(null);

  const [processing, setProcessing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef();
  const imgInputRef = useRef();

  /* ── Load PDF ── */
  const loadFile = async (f) => {
    if (!f || f.type !== 'application/pdf') return;
    setFile(f);
    try {
      const bytes = await f.arrayBuffer();
      const bytesArr = new Uint8Array(bytes);
      setPdfBytes(bytesArr);
      const doc = await PDFDocument.load(bytesArr);
      setPageCount(doc.getPageCount());
    } catch (err) {
      alert('Error loading: ' + err.message);
    }
  };

  /* ── Render first page as preview background ── */
  useEffect(() => {
    if (!pdfBytes) { setPreviewUrl(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const pdf = await pdfjsLib.getDocument({ data: pdfBytes.slice() }).promise;
        const page = await pdf.getPage(1);
        const vp = page.getViewport({ scale: 1.0 });
        // Scale to fit ~500px wide
        const targetW = 500;
        const scale = targetW / vp.width;
        const scaledVp = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = scaledVp.width;
        canvas.height = scaledVp.height;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport: scaledVp }).promise;
        if (cancelled) return;
        setPreviewUrl(canvas.toDataURL());
        setPreviewSize({ width: scaledVp.width, height: scaledVp.height });
      } catch (e) {
        console.error('Preview render error:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [pdfBytes]);

  /* ── Load watermark image ── */
  const loadWmImage = (f) => {
    if (!f || !f.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        setWmImage({ dataUrl: e.target.result, name: f.name, width: img.width, height: img.height });
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(f);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    loadFile(e.dataTransfer.files[0]);
  };

  /* ── Watermark element dimensions for preview ── */
  const getWmPreviewStyle = useCallback(() => {
    const base = {
      position: 'absolute',
      left: `${posX}%`,
      top: `${posY}%`,
      transform: `translate(-50%, -50%) rotate(${angle}deg)`,
      opacity,
      cursor: dragging ? 'grabbing' : 'grab',
      userSelect: 'none',
      pointerEvents: 'auto',
    };
    if (mode === 'text') {
      const previewFontSize = previewSize.width > 0
        ? Math.max(8, fontSize * (previewSize.width / 612)) // 612 = typical PDF width in points
        : Math.min(fontSize * 0.5, 40);
      return {
        ...base,
        fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
        fontSize: `${previewFontSize}px`,
        fontWeight: 700,
        color,
        whiteSpace: 'nowrap',
      };
    } else {
      const imgW = previewSize.width > 0 ? previewSize.width * (imageScale / 100) : 100;
      return {
        ...base,
        width: imgW,
        height: 'auto',
      };
    }
  }, [posX, posY, angle, opacity, mode, fontSize, previewSize, color, imageScale, dragging]);

  /* ── Drag to reposition ── */
  const handlePointerDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY, startPosX: posX, startPosY: posY };
    e.target.setPointerCapture(e.pointerId);
  }, [posX, posY]);

  const handlePointerMove = useCallback((e) => {
    if (!dragging || !dragStartRef.current || !previewContainerRef.current) return;
    const rect = previewContainerRef.current.getBoundingClientRect();
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    const newX = Math.max(0, Math.min(100, dragStartRef.current.startPosX + (dx / rect.width) * 100));
    const newY = Math.max(0, Math.min(100, dragStartRef.current.startPosY + (dy / rect.height) * 100));
    setPosX(Math.round(newX * 10) / 10);
    setPosY(Math.round(newY * 10) / 10);
  }, [dragging]);

  const handlePointerUp = useCallback(() => {
    setDragging(false);
    dragStartRef.current = null;
  }, []);

  /* ── Export / Stamp ── */
  const stamp = async () => {
    if (!file) return;
    if (mode === 'text' && !text.trim()) return;
    if (mode === 'image' && !wmImage) return;
    setProcessing(true);
    try {
      const doc = await PDFDocument.load(pdfBytes);
      const pages = doc.getPages();

      if (mode === 'text') {
        const font = await doc.embedFont(StandardFonts.HelveticaBold);
        const r = parseInt(color.slice(1, 3), 16) / 255;
        const g = parseInt(color.slice(3, 5), 16) / 255;
        const b = parseInt(color.slice(5, 7), 16) / 255;

        pages.forEach(page => {
          const { width, height } = page.getSize();
          const textWidth = font.widthOfTextAtSize(text, fontSize);
          const textHeight = fontSize;
          const x = (posX / 100) * width - textWidth / 2;
          const y = height - (posY / 100) * height - textHeight / 2;

          page.drawText(text, {
            x,
            y,
            size: fontSize,
            font,
            color: rgb(r, g, b),
            opacity,
            rotate: degrees(-angle),
          });
        });
      } else {
        // Image watermark
        const imgBytes = await fetch(wmImage.dataUrl).then(r => r.arrayBuffer());
        let embeddedImg;
        if (wmImage.dataUrl.includes('image/png')) {
          embeddedImg = await doc.embedPng(imgBytes);
        } else {
          embeddedImg = await doc.embedJpg(imgBytes);
        }

        pages.forEach(page => {
          const { width, height } = page.getSize();
          const imgW = width * (imageScale / 100);
          const imgH = imgW * (wmImage.height / wmImage.width);
          const x = (posX / 100) * width - imgW / 2;
          const y = height - (posY / 100) * height - imgH / 2;

          page.drawImage(embeddedImg, {
            x,
            y,
            width: imgW,
            height: imgH,
            opacity,
            rotate: degrees(-angle),
          });
        });
      }

      const pdfOut = await doc.save();
      const blob = new Blob([pdfOut], { type: 'application/pdf' });
      saveAs(blob, 'watermarked.pdf');
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const canStamp = mode === 'text' ? !!text.trim() : !!wmImage;

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
          <div className="dropzone-icon">{'\uD83D\uDCA7'}</div>
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
              <button className="file-remove" onClick={() => { setFile(null); setPageCount(0); setPdfBytes(null); setPreviewUrl(null); }}>{'\u00D7'}</button>
            </div>
          </div>

          <div className="controls">
            <h3>Watermark settings</h3>

            {/* Mode toggle */}
            <div className="control-row" style={{ gap: 8 }}>
              <span className="control-label">Type</span>
              <div style={{
                display: 'flex', gap: 0, borderRadius: 6,
                border: '2px solid var(--sketch-text)',
                overflow: 'hidden', flex: 1, maxWidth: 240,
              }}>
                {['text', 'image'].map(m => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    style={{
                      flex: 1, padding: '6px 0',
                      background: mode === m ? 'var(--sketch-text)' : 'var(--surface)',
                      color: mode === m ? 'var(--surface)' : 'var(--sketch-text)',
                      border: 'none', cursor: 'pointer',
                      fontFamily: 'var(--font-hand)', fontSize: '0.95rem',
                      fontWeight: mode === m ? 700 : 400,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {m === 'text' ? 'Text' : 'Image'}
                  </button>
                ))}
              </div>
            </div>

            {/* Text-specific controls */}
            {mode === 'text' && (
              <>
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
                  <span className="control-label">Color</span>
                  <input
                    type="color"
                    value={color}
                    onChange={e => setColor(e.target.value)}
                    style={{
                      width: 36, height: 30, padding: 0,
                      border: '2px solid var(--sketch-text)',
                      borderRadius: 4, cursor: 'pointer', background: 'none',
                    }}
                  />
                  <span style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 6,
                  }}>{color}</span>
                </div>
              </>
            )}

            {/* Image-specific controls */}
            {mode === 'image' && (
              <>
                <div className="control-row">
                  <span className="control-label">Image</span>
                  {wmImage ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                      <img
                        src={wmImage.dataUrl}
                        alt="watermark"
                        style={{
                          width: 36, height: 36, objectFit: 'contain',
                          border: '2px solid var(--sketch-text)', borderRadius: 4,
                          background: 'var(--surface)',
                        }}
                      />
                      <span style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '0.75rem', color: 'var(--text-muted)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{wmImage.name}</span>
                      <button
                        className="file-remove"
                        onClick={() => setWmImage(null)}
                        style={{ marginLeft: 'auto' }}
                      >{'\u00D7'}</button>
                    </div>
                  ) : (
                    <button
                      className="btn btn-secondary"
                      onClick={() => imgInputRef.current?.click()}
                      style={{ fontSize: '0.85rem', padding: '4px 14px' }}
                    >
                      Choose image
                    </button>
                  )}
                  <input
                    ref={imgInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg"
                    hidden
                    onChange={e => { loadWmImage(e.target.files[0]); e.target.value = ''; }}
                  />
                </div>
                <div className="control-row">
                  <span className="control-label">Scale</span>
                  <input
                    type="range"
                    min={5}
                    max={80}
                    step={1}
                    value={imageScale}
                    onChange={e => setImageScale(Number(e.target.value))}
                    style={{ flex: 1, maxWidth: 200 }}
                  />
                  <span style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '0.75rem', color: 'var(--text-muted)',
                  }}>{imageScale}%</span>
                </div>
              </>
            )}

            {/* Shared controls */}
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
              <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.75rem', color: 'var(--text-muted)',
              }}>{Math.round(opacity * 100)}%</span>
            </div>
            <div className="control-row">
              <span className="control-label">Angle</span>
              <input
                className="control-input"
                type="number"
                min={-180}
                max={180}
                value={angle}
                onChange={e => setAngle(Number(e.target.value))}
                style={{ width: 70 }}
              />
              <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.75rem', color: 'var(--text-muted)',
              }}>degrees</span>
            </div>
          </div>

          {/* ── Live preview with real PDF page ── */}
          <div
            ref={previewContainerRef}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            style={{
              position: 'relative',
              background: 'var(--surface)',
              border: '2px solid var(--sketch-text)',
              borderRadius: 4,
              marginBottom: '1.5rem',
              overflow: 'hidden',
              userSelect: 'none',
            }}
          >
            {/* PDF page background */}
            {previewUrl ? (
              <img
                ref={previewRef}
                src={previewUrl}
                alt="PDF preview"
                draggable={false}
                style={{ width: '100%', display: 'block' }}
              />
            ) : (
              <div style={{
                minHeight: 200, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-muted)', fontFamily: 'var(--font-hand)',
              }}>Loading preview...</div>
            )}

            {/* Watermark overlay — draggable */}
            {previewUrl && (
              <div
                onPointerDown={handlePointerDown}
                style={getWmPreviewStyle()}
              >
                {mode === 'text' ? (
                  text || 'WATERMARK'
                ) : wmImage ? (
                  <img
                    src={wmImage.dataUrl}
                    alt="watermark"
                    draggable={false}
                    style={{ width: '100%', height: 'auto', display: 'block' }}
                  />
                ) : (
                  <div style={{
                    padding: '12px 20px',
                    border: '2px dashed var(--text-muted)',
                    borderRadius: 4,
                    fontFamily: 'var(--font-hand)',
                    fontSize: '0.85rem',
                    color: 'var(--text-muted)',
                  }}>No image selected</div>
                )}
              </div>
            )}

            {/* Hint */}
            <div style={{
              position: 'absolute', bottom: 6, right: 10,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.6rem', color: 'var(--text-muted)',
              pointerEvents: 'none',
            }}>drag to reposition</div>

            {/* Position indicator */}
            <div style={{
              position: 'absolute', bottom: 6, left: 10,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.6rem', color: 'var(--text-muted)',
              pointerEvents: 'none',
            }}>x: {posX.toFixed(1)}% y: {posY.toFixed(1)}%</div>
          </div>

          <div className="action-row">
            <button className="btn btn-primary" disabled={processing || !canStamp} onClick={stamp}>
              {processing ? 'Processing...' : 'Add Watermark'}
            </button>
            <button className="btn btn-secondary" onClick={() => {
              setFile(null); setPageCount(0); setPdfBytes(null); setPreviewUrl(null);
            }}>
              Choose another file
            </button>
          </div>
        </>
      )}
    </div>
  );
}
