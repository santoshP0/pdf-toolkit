import { useState } from 'react';
import usePdfTool from './shared/usePdfTool';
import { Dropzone, FileInfo, ProgressBar, ActionRow } from './shared/PdfToolUI';

import { getPdfjsLib } from './shared/pdfjs';

export default function PdfToImages() {
  const {
    file, setFile,
    pageCount, setPageCount,
    processing, setProcessing,
    progress, setProgress,
    dragOver, inputRef,
    dropzoneProps,
    reset, hasFile,
  } = usePdfTool();

  const [format, setFormat] = useState('png');
  const [scale, setScale] = useState(2);
  const [images, setImages] = useState([]);

  const loadFile = async (f) => {
    if (!f || f.type !== 'application/pdf') return;
    setFile(f);
    setImages([]);
    try {
      const pdfjsLib = await getPdfjsLib();
      const bytes = await f.arrayBuffer();
      const doc = await pdfjsLib.getDocument({ data: new Uint8Array(bytes) }).promise;
      setPageCount(doc.numPages);
    } catch (err) {
      alert('Error loading PDF: ' + err.message);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    dropzoneProps.onDragLeave();
    loadFile(e.dataTransfer.files[0]);
  };

  const handleInputChange = (e) => {
    loadFile(e.target.files[0]);
    e.target.value = '';
  };

  const convert = async () => {
    if (!file) return;
    setProcessing(true);
    setProgress(0);
    setImages([]);
    try {
      const pdfjsLib = await getPdfjsLib();
      const bytes = await file.arrayBuffer();
      const doc = await pdfjsLib.getDocument({ data: new Uint8Array(bytes) }).promise;
      const results = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const vp = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = vp.width;
        canvas.height = vp.height;
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
        const dataUrl = canvas.toDataURL(mimeType, 0.92);
        results.push({ page: i, dataUrl, mimeType });
        setProgress(Math.round((i / doc.numPages) * 100));
      }
      setImages(results);
    } catch (err) {
      alert('Error converting: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const downloadImage = (img) => {
    const ext = format === 'jpg' ? 'jpg' : 'png';
    const link = document.createElement('a');
    link.href = img.dataUrl;
    link.download = `page-${img.page}.${ext}`;
    link.click();
  };

  const downloadAll = () => {
    images.forEach((img, i) => {
      setTimeout(() => downloadImage(img), i * 200);
    });
  };

  const handleReset = () => {
    reset();
    setImages([]);
    setFormat('png');
    setScale(2);
  };

  const customDropzoneProps = {
    ...dropzoneProps,
    onDrop: handleDrop,
  };

  return (
    <div>
      {!hasFile ? (
        <Dropzone
          dragOver={dragOver}
          dropzoneProps={customDropzoneProps}
          inputRef={inputRef}
          onInputChange={handleInputChange}
          icon={'\uD83C\uDFDE\uFE0F'}
        />
      ) : (
        <>
          <FileInfo
            file={file}
            pageCount={pageCount}
            onRemove={handleReset}
          />

          <div className="controls">
            <h3>Export settings</h3>
            <div className="control-row">
              <span className="control-label">Format</span>
              <select className="control-select" value={format} onChange={e => setFormat(e.target.value)}>
                <option value="png">PNG</option>
                <option value="jpg">JPG</option>
              </select>
            </div>
            <div className="control-row">
              <span className="control-label">Scale</span>
              <select className="control-select" value={scale} onChange={e => setScale(Number(e.target.value))}>
                <option value={1}>1x</option>
                <option value={2}>2x</option>
                <option value={3}>3x</option>
              </select>
            </div>
          </div>

          {processing && (
            <ProgressBar progress={progress} label="Rendering..." />
          )}

          <ActionRow>
            <button className="btn btn-primary" disabled={processing} onClick={convert}>
              {processing ? 'Rendering...' : 'Convert to Images'}
            </button>
            {images.length > 0 && (
              <button className="btn btn-secondary" onClick={downloadAll}>
                Download all ({images.length})
              </button>
            )}
            <button className="btn btn-secondary" onClick={handleReset}>
              Choose another file
            </button>
          </ActionRow>

          {images.length > 0 && (
            <div className="thumb-grid" style={{ marginTop: '1.5rem' }}>
              {images.map((img) => (
                <div key={img.page} className="thumb-card" onClick={() => downloadImage(img)}>
                  <img src={img.dataUrl} alt={`Page ${img.page}`} />
                  <div className="thumb-label">Page {img.page}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
