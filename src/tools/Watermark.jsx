import { useState, useRef, useEffect, useCallback } from 'react';
import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import { saveAs } from 'file-saver';
import { formatSize } from '../App';
import * as pdfjsLib from 'pdfjs-dist';

/* ── Default layer factories ── */
let _layerId = 0;
const uid = () => `wm_${++_layerId}_${Date.now()}`;

const makeTextLayer = () => ({
  id: uid(), type: 'text', text: 'CONFIDENTIAL',
  fontSize: 60, color: '#808080', fontWeight: 'bold',
  opacity: 0.15, angle: -45,
  posX: 50, posY: 50,
});

const makeImageLayer = (dataUrl, name, w, h) => ({
  id: uid(), type: 'image', dataUrl, name, width: w, height: h,
  scale: 30, // % of page width
  opacity: 0.15, angle: 0,
  posX: 50, posY: 50,
});

export default function Watermark() {
  const [file, setFile] = useState(null);
  const [pdfBytes, setPdfBytes] = useState(null);
  const [pageCount, setPageCount] = useState(0);

  /* Layers */
  const [layers, setLayers] = useState([makeTextLayer()]);
  const [selectedId, setSelectedId] = useState(layers[0]?.id ?? null);

  /* Preview */
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewSize, setPreviewSize] = useState({ width: 0, height: 0 });
  const previewContainerRef = useRef(null);

  /* Drag */
  const [draggingId, setDraggingId] = useState(null);
  const dragStartRef = useRef(null);

  const [processing, setProcessing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef();
  const imgInputRef = useRef();

  const selectedLayer = layers.find(l => l.id === selectedId) || null;

  /* ── Helpers ── */
  const updateLayer = useCallback((id, patch) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));
  }, []);

  const removeLayer = useCallback((id) => {
    setLayers(prev => {
      const next = prev.filter(l => l.id !== id);
      return next;
    });
    if (selectedId === id) {
      setSelectedId(prev => {
        const remaining = layers.filter(l => l.id !== id);
        return remaining.length > 0 ? remaining[0].id : null;
      });
    }
  }, [selectedId, layers]);

  const addTextLayer = useCallback(() => {
    const l = makeTextLayer();
    setLayers(prev => [...prev, l]);
    setSelectedId(l.id);
  }, []);

  const addImageLayer = useCallback(() => {
    imgInputRef.current?.click();
  }, []);

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

  /* ── Render first page preview ── */
  useEffect(() => {
    if (!pdfBytes) { setPreviewUrl(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const pdf = await pdfjsLib.getDocument({ data: pdfBytes.slice() }).promise;
        const page = await pdf.getPage(1);
        const vp = page.getViewport({ scale: 1.0 });
        const scale = Math.min(560 / vp.width, 700 / vp.height);
        const svp = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = svp.width;
        canvas.height = svp.height;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport: svp }).promise;
        if (cancelled) return;
        setPreviewUrl(canvas.toDataURL());
        setPreviewSize({ width: svp.width, height: svp.height });
      } catch (e) { console.error('Preview error:', e); }
    })();
    return () => { cancelled = true; };
  }, [pdfBytes]);

  /* ── Load image for watermark ── */
  const handleImageFile = (f) => {
    if (!f || !f.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const l = makeImageLayer(e.target.result, f.name, img.width, img.height);
        setLayers(prev => [...prev, l]);
        setSelectedId(l.id);
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

  /* ── Dragging layers on preview ── */
  const handlePointerDown = useCallback((e, layerId) => {
    e.preventDefault();
    e.stopPropagation();
    const layer = layers.find(l => l.id === layerId);
    if (!layer) return;
    setDraggingId(layerId);
    setSelectedId(layerId);
    dragStartRef.current = { x: e.clientX, y: e.clientY, startX: layer.posX, startY: layer.posY };
    e.target.setPointerCapture(e.pointerId);
  }, [layers]);

  const handlePointerMove = useCallback((e) => {
    if (!draggingId || !dragStartRef.current || !previewContainerRef.current) return;
    const rect = previewContainerRef.current.getBoundingClientRect();
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    const newX = Math.max(0, Math.min(100, dragStartRef.current.startX + (dx / rect.width) * 100));
    const newY = Math.max(0, Math.min(100, dragStartRef.current.startY + (dy / rect.height) * 100));
    updateLayer(draggingId, {
      posX: Math.round(newX * 10) / 10,
      posY: Math.round(newY * 10) / 10,
    });
  }, [draggingId, updateLayer]);

  const handlePointerUp = useCallback(() => {
    setDraggingId(null);
    dragStartRef.current = null;
  }, []);

  /* ── Preview style per layer ── */
  const getLayerStyle = useCallback((layer) => {
    const base = {
      position: 'absolute',
      left: `${layer.posX}%`,
      top: `${layer.posY}%`,
      transform: `translate(-50%, -50%) rotate(${layer.angle}deg)`,
      opacity: layer.opacity,
      cursor: draggingId === layer.id ? 'grabbing' : 'grab',
      userSelect: 'none',
      pointerEvents: 'auto',
      outline: selectedId === layer.id ? '2px dashed rgba(59,130,246,0.7)' : 'none',
      outlineOffset: 4,
      zIndex: selectedId === layer.id ? 10 : 1,
    };
    if (layer.type === 'text') {
      const previewFS = previewSize.width > 0
        ? Math.max(8, layer.fontSize * (previewSize.width / 612))
        : Math.min(layer.fontSize * 0.5, 40);
      return {
        ...base,
        fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
        fontSize: `${previewFS}px`,
        fontWeight: layer.fontWeight === 'bold' ? 700 : 400,
        color: layer.color,
        whiteSpace: 'pre-wrap',
        textAlign: 'center',
        lineHeight: 1.3,
        maxWidth: '80%',
      };
    } else {
      const imgW = previewSize.width > 0 ? previewSize.width * (layer.scale / 100) : 100;
      return { ...base, width: imgW, height: 'auto' };
    }
  }, [previewSize, selectedId, draggingId]);

  /* ── Export ── */
  const stamp = async () => {
    if (!file || layers.length === 0) return;
    setProcessing(true);
    try {
      const doc = await PDFDocument.load(pdfBytes);
      const font = await doc.embedFont(StandardFonts.HelveticaBold);
      const fontNormal = await doc.embedFont(StandardFonts.Helvetica);
      const pages = doc.getPages();

      // Pre-embed all images — resized to actual target dimensions
      const embeddedImages = {};
      const maxPageW = Math.max(...pages.map(p => p.getSize().width));
      const maxPageH = Math.max(...pages.map(p => p.getSize().height));
      for (const layer of layers) {
        if (layer.type !== 'image') continue;
        const targetW = maxPageW * (layer.scale / 100);
        const targetH = targetW * (layer.height / layer.width);
        const isPng = layer.dataUrl.includes('image/png');
        const resizedBytes = await resizeImageForPdf(layer.dataUrl, targetW, targetH, isPng);
        if (isPng) {
          embeddedImages[layer.id] = await doc.embedPng(resizedBytes);
        } else {
          embeddedImages[layer.id] = await doc.embedJpg(resizedBytes);
        }
      }

      pages.forEach(page => {
        const { width, height } = page.getSize();

        for (const layer of layers) {
          if (layer.type === 'text') {
            if (!layer.text.trim()) continue;
            const f = layer.fontWeight === 'bold' ? font : fontNormal;
            const r = parseInt(layer.color.slice(1, 3), 16) / 255;
            const g = parseInt(layer.color.slice(3, 5), 16) / 255;
            const b = parseInt(layer.color.slice(5, 7), 16) / 255;
            const lines = layer.text.split('\n');
            const lineHeight = layer.fontSize * 1.3;
            const totalH = lines.length * lineHeight;
            const baseY = height - (layer.posY / 100) * height + totalH / 2;

            lines.forEach((line, li) => {
              const tw = f.widthOfTextAtSize(line, layer.fontSize);
              const x = (layer.posX / 100) * width - tw / 2;
              const y = baseY - li * lineHeight - layer.fontSize;
              page.drawText(line, {
                x, y,
                size: layer.fontSize,
                font: f,
                color: rgb(r, g, b),
                opacity: layer.opacity,
                rotate: degrees(-layer.angle),
              });
            });
          } else {
            const emb = embeddedImages[layer.id];
            if (!emb) continue;
            const imgW = width * (layer.scale / 100);
            const imgH = imgW * (layer.height / layer.width);
            const x = (layer.posX / 100) * width - imgW / 2;
            const y = height - (layer.posY / 100) * height - imgH / 2;
            page.drawImage(emb, {
              x, y, width: imgW, height: imgH,
              opacity: layer.opacity,
              rotate: degrees(-layer.angle),
            });
          }
        }
      });

      const pdfOut = await doc.save();
      saveAs(new Blob([pdfOut], { type: 'application/pdf' }), 'watermarked.pdf');
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  /* ── Render ── */
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
          <input ref={inputRef} type="file" accept=".pdf" hidden
            onChange={e => { loadFile(e.target.files[0]); e.target.value = ''; }} />
        </div>
      ) : (
        <>
          {/* File info */}
          <div className="file-list">
            <div className="file-item">
              <span className="file-name">{file.name}</span>
              <span className="file-size">{formatSize(file.size)} &middot; {pageCount} pages</span>
              <button className="file-remove" onClick={() => {
                setFile(null); setPageCount(0); setPdfBytes(null); setPreviewUrl(null);
              }}>{'\u00D7'}</button>
            </div>
          </div>

          {/* Main layout: preview left, controls right */}
          <div style={{
            display: 'flex', gap: 16, marginBottom: '1.5rem',
            flexDirection: 'row', flexWrap: 'wrap',
          }}>
            {/* ── Preview ── */}
            <div style={{ flex: '1 1 340px', minWidth: 280 }}>
              <div
                ref={previewContainerRef}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                style={{
                  position: 'relative',
                  background: '#e8e4df',
                  border: '2px solid var(--sketch-text)',
                  borderRadius: 4,
                  overflow: 'hidden',
                  userSelect: 'none',
                }}
              >
                {previewUrl ? (
                  <img src={previewUrl} alt="PDF preview" draggable={false}
                    style={{ width: '100%', display: 'block' }} />
                ) : (
                  <div style={{
                    minHeight: 200, display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    color: 'var(--text-muted)', fontFamily: 'var(--font-hand)',
                  }}>Loading preview...</div>
                )}

                {/* Render all layers */}
                {previewUrl && layers.map(layer => (
                  <div
                    key={layer.id}
                    onPointerDown={e => handlePointerDown(e, layer.id)}
                    style={getLayerStyle(layer)}
                  >
                    {layer.type === 'text' ? (
                      layer.text || 'WATERMARK'
                    ) : (
                      <img src={layer.dataUrl} alt={layer.name} draggable={false}
                        style={{ width: '100%', height: 'auto', display: 'block' }} />
                    )}
                  </div>
                ))}

                <div style={{
                  position: 'absolute', bottom: 5, right: 8,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.55rem', color: 'var(--text-muted)',
                  pointerEvents: 'none', opacity: 0.7,
                }}>drag to reposition</div>
              </div>
            </div>

            {/* ── Controls panel ── */}
            <div style={{ flex: '1 1 260px', minWidth: 240, maxWidth: 360 }}>
              {/* Layer list */}
              <div style={{
                border: '2px solid var(--sketch-text)', borderRadius: 4,
                marginBottom: 12, overflow: 'hidden',
              }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '6px 10px',
                  background: 'var(--sketch-text)', color: 'var(--surface)',
                  fontFamily: 'var(--font-hand)', fontSize: '0.9rem', fontWeight: 700,
                }}>
                  <span>Layers ({layers.length})</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={addTextLayer} title="Add text"
                      style={addBtnStyle}>+ Text</button>
                    <button onClick={addImageLayer} title="Add image"
                      style={addBtnStyle}>+ Image</button>
                  </div>
                </div>
                <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                  {layers.length === 0 && (
                    <div style={{
                      padding: '16px 10px', textAlign: 'center',
                      color: 'var(--text-muted)', fontFamily: 'var(--font-hand)',
                      fontSize: '0.85rem',
                    }}>No layers yet. Add text or image above.</div>
                  )}
                  {layers.map((l, i) => (
                    <div key={l.id}
                      onClick={() => setSelectedId(l.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '5px 10px', cursor: 'pointer',
                        background: selectedId === l.id ? 'rgba(59,130,246,0.1)' : 'transparent',
                        borderBottom: '1px solid var(--divider, #e0e0e0)',
                        fontFamily: "'JetBrains Mono', monospace", fontSize: '0.72rem',
                      }}
                    >
                      <span style={{
                        width: 18, height: 18, borderRadius: 3,
                        background: l.type === 'text' ? '#e3e8f0' : '#f0e8e3',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.6rem', flexShrink: 0,
                      }}>{l.type === 'text' ? 'T' : 'I'}</span>
                      <span style={{
                        flex: 1, overflow: 'hidden', textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {l.type === 'text'
                          ? (l.text.slice(0, 20) || 'Empty text')
                          : (l.name || 'Image')}
                      </span>
                      <button onClick={(e) => { e.stopPropagation(); removeLayer(l.id); }}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: 'var(--text-muted)', fontSize: '0.9rem', padding: '0 2px',
                          lineHeight: 1,
                        }}>{'\u00D7'}</button>
                    </div>
                  ))}
                </div>
              </div>

              <input ref={imgInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/svg+xml" hidden
                onChange={e => { handleImageFile(e.target.files[0]); e.target.value = ''; }} />

              {/* Selected layer properties */}
              {selectedLayer ? (
                <div className="controls" style={{ marginBottom: 0, paddingTop: 8 }}>
                  <h3 style={{ margin: '0 0 8px', fontSize: '1rem' }}>
                    {selectedLayer.type === 'text' ? 'Text' : 'Image'} properties
                  </h3>

                  {selectedLayer.type === 'text' && (
                    <>
                      <div className="control-row">
                        <span className="control-label">Text</span>
                        <textarea
                          className="control-input"
                          value={selectedLayer.text}
                          onChange={e => updateLayer(selectedId, { text: e.target.value })}
                          rows={Math.min(4, Math.max(2, selectedLayer.text.split('\n').length))}
                          style={{
                            flex: 1, resize: 'vertical', minHeight: 40,
                            fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8rem',
                          }}
                        />
                      </div>
                      <div className="control-row">
                        <span className="control-label">Size</span>
                        <input className="control-input" type="number" min={8} max={300}
                          value={selectedLayer.fontSize}
                          onChange={e => updateLayer(selectedId, { fontSize: Number(e.target.value) })}
                          style={{ width: 65 }} />
                        <span style={monoHint}>pt</span>
                      </div>
                      <div className="control-row">
                        <span className="control-label">Weight</span>
                        <div style={{
                          display: 'flex', gap: 0, borderRadius: 4,
                          border: '2px solid var(--sketch-text)', overflow: 'hidden',
                        }}>
                          {['normal', 'bold'].map(w => (
                            <button key={w} onClick={() => updateLayer(selectedId, { fontWeight: w })}
                              style={{
                                padding: '3px 12px', border: 'none', cursor: 'pointer',
                                background: selectedLayer.fontWeight === w ? 'var(--sketch-text)' : 'var(--surface)',
                                color: selectedLayer.fontWeight === w ? 'var(--surface)' : 'var(--sketch-text)',
                                fontFamily: 'var(--font-hand)', fontSize: '0.8rem',
                                fontWeight: w === 'bold' ? 700 : 400,
                              }}>
                              {w === 'bold' ? 'Bold' : 'Normal'}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="control-row">
                        <span className="control-label">Color</span>
                        <input type="color" value={selectedLayer.color}
                          onChange={e => updateLayer(selectedId, { color: e.target.value })}
                          style={{
                            width: 32, height: 26, padding: 0,
                            border: '2px solid var(--sketch-text)', borderRadius: 3,
                            cursor: 'pointer', background: 'none',
                          }} />
                        <span style={monoHint}>{selectedLayer.color}</span>
                      </div>
                    </>
                  )}

                  {selectedLayer.type === 'image' && (
                    <>
                      <div className="control-row">
                        <span className="control-label">File</span>
                        <span style={{
                          ...monoHint,
                          overflow: 'hidden', textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap', flex: 1,
                        }}>{selectedLayer.name}</span>
                      </div>
                      <div className="control-row">
                        <span className="control-label">Scale</span>
                        <input type="range" min={3} max={100} step={1}
                          value={selectedLayer.scale}
                          onChange={e => updateLayer(selectedId, { scale: Number(e.target.value) })}
                          style={{ flex: 1, maxWidth: 140 }} />
                        <span style={monoHint}>{selectedLayer.scale}%</span>
                      </div>
                    </>
                  )}

                  {/* Shared controls */}
                  <div className="control-row">
                    <span className="control-label">Opacity</span>
                    <input type="range" min={0.02} max={1} step={0.02}
                      value={selectedLayer.opacity}
                      onChange={e => updateLayer(selectedId, { opacity: Number(e.target.value) })}
                      style={{ flex: 1, maxWidth: 140 }} />
                    <span style={monoHint}>{Math.round(selectedLayer.opacity * 100)}%</span>
                  </div>
                  <div className="control-row">
                    <span className="control-label">Angle</span>
                    <input className="control-input" type="number" min={-180} max={180}
                      value={selectedLayer.angle}
                      onChange={e => updateLayer(selectedId, { angle: Number(e.target.value) })}
                      style={{ width: 60 }} />
                    <span style={monoHint}>deg</span>
                  </div>
                  <div className="control-row">
                    <span className="control-label">Position</span>
                    <span style={monoHint}>
                      x: {selectedLayer.posX.toFixed(1)}% &nbsp; y: {selectedLayer.posY.toFixed(1)}%
                    </span>
                  </div>
                </div>
              ) : (
                <div style={{
                  padding: '20px 10px', textAlign: 'center',
                  color: 'var(--text-muted)', fontFamily: 'var(--font-hand)', fontSize: '0.9rem',
                }}>Select a layer to edit its properties</div>
              )}
            </div>
          </div>

          <div className="action-row">
            <button className="btn btn-primary" disabled={processing || layers.length === 0} onClick={stamp}>
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

/* ── Resize + compress image to target PDF dimensions ── */
function resizeImageForPdf(dataUrl, targetW, targetH, isPng) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      // 2x for retina-quality, capped at original size
      const w = Math.min(Math.round(targetW * 2), img.width);
      const h = Math.min(Math.round(targetH * 2), img.height);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      // Use PNG only if source was PNG (may have transparency), else JPEG at 0.8
      canvas.toBlob(
        (blob) => blob.arrayBuffer().then(resolve),
        isPng ? 'image/png' : 'image/jpeg',
        isPng ? undefined : 0.8,
      );
    };
    img.src = dataUrl;
  });
}

/* ── Tiny inline styles ── */
const addBtnStyle = {
  padding: '2px 8px', border: '1px solid var(--surface)', borderRadius: 3,
  background: 'transparent', color: 'var(--surface)', cursor: 'pointer',
  fontFamily: 'var(--font-hand)', fontSize: '0.7rem', fontWeight: 600,
  opacity: 0.9,
};

const monoHint = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '0.72rem',
  color: 'var(--text-muted)',
};
