import { useState, useCallback, useRef, useEffect } from 'react';
import { PDFDocument } from 'pdf-lib';
import usePdfTool from './shared/usePdfTool';
import useSignaturePad from './shared/useSignaturePad';
import { loadPdfjsDoc, renderPageToCanvas } from './shared/pdfjs';
import { Dropzone, FileInfo, ActionRow } from './shared/PdfToolUI';

const TABS = [
  { id: 'draw', label: 'Draw' },
  { id: 'type', label: 'Type' },
  { id: 'upload', label: 'Upload' },
];

export default function SignPdf() {
  const {
    file, setFile, processing, setProcessing,
    dragOver, inputRef, dropzoneProps, reset, exportPdfBytes, hasFile,
  } = usePdfTool();

  const { canvasRef, padProps, isEmpty, clear, toDataURL } = useSignaturePad();

  const [tab, setTab] = useState('draw');
  const [typed, setTyped] = useState('');
  const [uploaded, setUploaded] = useState(null);
  const [signature, setSignature] = useState(null); // { url, ratio } locked-in signature

  const [pages, setPages] = useState([]); // rendered previews {thumb, w, h}
  const [pageIdx, setPageIdx] = useState(0);
  const [pos, setPos] = useState({ x: 0.6, y: 0.85 }); // normalized center
  const [sizePct, setSizePct] = useState(25); // signature width as % of page
  const [allPages, setAllPages] = useState(false);
  const [loading, setLoading] = useState(false);

  const sigImgRef = useRef(null);

  const loadFile = useCallback(async (f) => {
    if (!f || f.type !== 'application/pdf') return;
    setFile(f);
    setLoading(true);
    setPages([]);
    try {
      const doc = await loadPdfjsDoc(await f.arrayBuffer());
      const out = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const base = page.getViewport({ scale: 1 });
        const scale = Math.min(1, 520 / base.width);
        const { canvas, width, height } = await renderPageToCanvas(page, scale, { background: '#fff' });
        out.push({ thumb: canvas.toDataURL(), w: width, h: height });
      }
      setPages(out);
      setPageIdx(0);
    } catch (err) {
      alert('Error loading: ' + err.message);
      reset();
    } finally {
      setLoading(false);
    }
  }, [setFile, reset]);

  const customDropzoneProps = {
    ...dropzoneProps,
    onDrop: (e) => { e.preventDefault(); loadFile(e.dataTransfer.files[0]); },
  };

  const onInputChange = useCallback((e) => {
    loadFile(e.target.files[0]);
    e.target.value = '';
  }, [loadFile]);

  // Build a PNG for typed signatures.
  const buildTyped = useCallback((text) => {
    if (!text.trim()) return null;
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 200;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1a1a2e';
    ctx.font = "72px 'Segoe Script', 'Brush Script MT', cursive";
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    return canvas.toDataURL('image/png');
  }, []);

  const onUpload = useCallback((e) => {
    const f = e.target.files[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    setUploaded(url);
    e.target.value = '';
  }, []);

  // Lock in a signature and measure its aspect ratio.
  const applySignature = useCallback((url) => {
    if (!url) return;
    const img = new Image();
    img.onload = () => setSignature({ url, ratio: img.width / img.height });
    img.src = url;
  }, []);

  const confirmSignature = useCallback(() => {
    if (tab === 'draw') applySignature(toDataURL());
    else if (tab === 'type') applySignature(buildTyped(typed));
    else if (tab === 'upload') applySignature(uploaded);
  }, [tab, applySignature, toDataURL, buildTyped, typed, uploaded]);

  useEffect(() => () => { if (uploaded) URL.revokeObjectURL(uploaded); }, [uploaded]);

  const onPreviewClick = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPos({
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    });
  }, []);

  const handleReset = useCallback(() => {
    reset();
    setPages([]);
    setSignature(null);
    setTyped('');
    setUploaded(null);
  }, [reset]);

  const save = useCallback(async () => {
    if (!file || !signature) return;
    setProcessing(true);
    try {
      const doc = await PDFDocument.load(await file.arrayBuffer());
      const bytes = await (await fetch(signature.url)).arrayBuffer();
      const isJpg = /^data:image\/jpe?g/.test(signature.url);
      const embed = isJpg
        ? await doc.embedJpg(bytes).catch(() => doc.embedPng(bytes))
        : await doc.embedPng(bytes).catch(() => doc.embedJpg(bytes));

      const targets = allPages ? doc.getPages() : [doc.getPages()[pageIdx]];
      for (const page of targets) {
        const { width, height } = page.getSize();
        const w = width * (sizePct / 100);
        const h = w / signature.ratio;
        const cx = width * pos.x;
        const cy = height * (1 - pos.y); // preview y is top-down
        page.drawImage(embed, { x: cx - w / 2, y: cy - h / 2, width: w, height: h });
      }
      exportPdfBytes(await doc.save(), 'signed.pdf');
      handleReset();
    } catch (err) {
      alert('Error: ' + err.message);
      setProcessing(false);
    }
  }, [file, signature, allPages, pageIdx, sizePct, pos, setProcessing, exportPdfBytes, handleReset]);

  const preview = pages[pageIdx];

  return (
    <div>
      {!hasFile ? (
        <Dropzone
          dragOver={dragOver}
          dropzoneProps={customDropzoneProps}
          inputRef={inputRef}
          onInputChange={onInputChange}
          icon={'🖊️'}
        />
      ) : loading ? (
        <div className="progress-text">Loading pages...</div>
      ) : (
        <>
          <FileInfo file={file} pageCount={pages.length} onRemove={handleReset} />

          {!signature ? (
            <div className="controls">
              <h3>Create your signature</h3>
              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                {TABS.map(t => (
                  <button
                    key={t.id}
                    className={`btn ${tab === t.id ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '6px 14px', fontSize: 13 }}
                    onClick={() => setTab(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {tab === 'draw' && (
                <div>
                  <canvas
                    ref={canvasRef}
                    width={600}
                    height={180}
                    {...padProps}
                    style={{
                      width: '100%', maxWidth: 600, height: 180,
                      border: '2px dashed var(--sketch-text)', borderRadius: 6,
                      background: '#fff', cursor: 'crosshair', display: 'block',
                    }}
                  />
                  <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                    <button className="btn btn-secondary" onClick={clear}>Clear</button>
                    <button className="btn btn-primary" disabled={isEmpty} onClick={confirmSignature}>Use signature</button>
                  </div>
                </div>
              )}

              {tab === 'type' && (
                <div>
                  <input
                    className="control-input"
                    type="text"
                    value={typed}
                    placeholder="Type your name"
                    onChange={e => setTyped(e.target.value)}
                    style={{ width: '100%', maxWidth: 400, fontSize: 20, padding: '10px 14px' }}
                  />
                  {typed && (
                    <div style={{
                      marginTop: 12, fontFamily: "'Segoe Script','Brush Script MT',cursive",
                      fontSize: 44, color: '#1a1a2e', background: '#fff',
                      padding: '10px 20px', borderRadius: 6, display: 'inline-block',
                      border: '2px dashed var(--sketch-text)',
                    }}>
                      {typed}
                    </div>
                  )}
                  <div style={{ marginTop: 10 }}>
                    <button className="btn btn-primary" disabled={!typed.trim()} onClick={confirmSignature}>Use signature</button>
                  </div>
                </div>
              )}

              {tab === 'upload' && (
                <div>
                  <input type="file" accept="image/png,image/jpeg" onChange={onUpload} />
                  {uploaded && (
                    <div style={{ marginTop: 12 }}>
                      <img src={uploaded} alt="Signature" style={{ maxHeight: 120, background: '#fff', borderRadius: 6, border: '2px dashed var(--sketch-text)', padding: 6 }} />
                      <div style={{ marginTop: 10 }}>
                        <button className="btn btn-primary" onClick={confirmSignature}>Use signature</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="controls">
                <h3>Place signature — click on the page</h3>
                <div className="control-row">
                  <span className="control-label">Page</span>
                  <select
                    className="control-select"
                    value={pageIdx}
                    onChange={e => setPageIdx(Number(e.target.value))}
                    disabled={allPages}
                  >
                    {pages.map((_, i) => <option key={i} value={i}>Page {i + 1}</option>)}
                  </select>
                </div>
                <div className="control-row">
                  <span className="control-label">Size</span>
                  <input
                    type="range" min={8} max={60} step={1}
                    value={sizePct} onChange={e => setSizePct(Number(e.target.value))}
                    style={{ flex: 1 }}
                  />
                  <span className="control-label" style={{ width: 44, textAlign: 'right' }}>{sizePct}%</span>
                </div>
                <div className="control-row">
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input type="checkbox" checked={allPages} onChange={e => setAllPages(e.target.checked)} />
                    <span className="control-label" style={{ margin: 0 }}>Apply to all pages</span>
                  </label>
                  <button className="btn btn-secondary" style={{ marginLeft: 'auto' }} onClick={() => setSignature(null)}>
                    Redo signature
                  </button>
                </div>
              </div>

              {preview && (
                <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                  <div
                    onClick={onPreviewClick}
                    style={{
                      position: 'relative', display: 'inline-block', cursor: 'crosshair',
                      lineHeight: 0, borderRadius: 4, border: '2px solid var(--sketch-text)',
                    }}
                  >
                    <img src={preview.thumb} alt={`Page ${pageIdx + 1}`} style={{ display: 'block', width: preview.w, height: preview.h }} />
                    <img
                      ref={sigImgRef}
                      src={signature.url}
                      alt="Signature"
                      style={{
                        position: 'absolute',
                        left: `${pos.x * 100}%`,
                        top: `${pos.y * 100}%`,
                        width: `${sizePct}%`,
                        transform: 'translate(-50%, -50%)',
                        pointerEvents: 'none',
                      }}
                    />
                  </div>
                </div>
              )}

              <ActionRow>
                <button className="btn btn-primary" disabled={processing} onClick={save}>
                  {processing ? 'Signing...' : 'Sign PDF'}
                </button>
                <button className="btn btn-secondary" onClick={handleReset}>Choose another file</button>
              </ActionRow>
            </>
          )}
        </>
      )}
    </div>
  );
}
