import { useState, useEffect } from 'react';
import usePdfTool from './shared/usePdfTool';
import { loadPdfjsDoc, renderPageToCanvas } from './shared/pdfjs';
import { Dropzone, FileInfo, ProgressBar, ActionRow } from './shared/PdfToolUI';

export default function OcrText({ onSwitchToExtract }) {
  const {
    file, setFile,
    processing, setProcessing,
    progress, setProgress,
    dragOver, inputRef,
    dropzoneProps,
    reset,
    hasFile,
  } = usePdfTool({ acceptTypes: ['application/pdf', 'image/*'] });

  const [text, setText] = useState('');
  const [preview, setPreview] = useState(null);
  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const loadFile = (f) => {
    if (!f) return;
    const isImage = f.type.startsWith('image/');
    const isPdf = f.type === 'application/pdf';
    if (!isImage && !isPdf) {
      alert('Please upload an image or PDF file');
      return;
    }
    setFile(f);
    setText('');
    if (isImage) {
      setPreview(URL.createObjectURL(f));
    } else {
      setPreview(null);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    loadFile(e.dataTransfer.files[0]);
  };

  const onInputChange = (e) => {
    loadFile(e.target.files[0]);
    e.target.value = '';
  };

  const handleReset = () => {
    reset();
    setText('');
    setPreview(null);
  };

  const runOcr = async () => {
    if (!file) return;
    setProcessing(true);
    setProgress(0);
    setText('');
    setStatusMsg('Loading OCR engine...');
    let worker;
    let pdfDocument;

    try {
      let pageCount = 1;
      if (file.type === 'application/pdf') {
        pdfDocument = await loadPdfjsDoc(await file.arrayBuffer());
        pageCount = pdfDocument.numPages;
      }

      const Tesseract = await import('tesseract.js');
      const runtime = `${import.meta.env.BASE_URL}runtime/ocr`;
      let currentIndex = 0;
      worker = await Tesseract.createWorker('eng', 1, {
        workerPath: `${runtime}/worker.min.js`,
        corePath: `${runtime}/tesseract-core-lstm.wasm.js`,
        langPath: runtime,
        workerBlobURL: false,
        logger: message => {
          if (message.status === 'recognizing text') {
            setProgress(Math.round((currentIndex + message.progress) / pageCount * 100));
          }
        },
      });
      let allText = '';

      for (let i = 0; i < pageCount; i++) {
        currentIndex = i;
        setStatusMsg(`Recognizing page ${i + 1} of ${pageCount}...`);
        let pageCanvas;
        if (pdfDocument) {
          const page = await pdfDocument.getPage(i + 1);
          const { canvas } = await renderPageToCanvas(page, 2);
          pageCanvas = canvas;
        }
        const result = await worker.recognize(pageCanvas || file);
        if (pageCanvas) { pageCanvas.width = 0; pageCanvas.height = 0; }
        allText += (i > 0 ? '\n\n--- Page ' + (i + 1) + ' ---\n\n' : '') + result.data.text;
      }

      setText(allText);
      setStatusMsg('Done!');
    } catch (err) {
      alert('OCR error: ' + err.message);
      setStatusMsg('');
    } finally {
      if (worker) await worker.terminate();
      if (pdfDocument) await pdfDocument.destroy();
      setProcessing(false);
    }
  };

  const copyText = () => {
    navigator.clipboard.writeText(text).then(() => {
      setStatusMsg('Copied to clipboard!');
      setTimeout(() => setStatusMsg(''), 2000);
    });
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
          onInputChange={onInputChange}
          icon={'\uD83D\uDD0D'}
          label="Drop a PDF or image here"
          accept=".pdf,image/*"
        />
      ) : (
        <>
          <FileInfo
            file={file}
            onRemove={handleReset}
          />

          {preview && (
            <div style={{ marginBottom: '1rem', textAlign: 'center' }}>
              <img src={preview} alt="Preview" style={{ maxWidth: '100%', maxHeight: 300, borderRadius: 4, border: '2px solid var(--sketch-text)' }} />
            </div>
          )}

          <div className="controls" style={{ marginBottom: '0.75rem' }}>
            <div className="control-row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{
                fontSize: 11, fontWeight: 600, letterSpacing: '0.04em',
                padding: '3px 8px', borderRadius: 6,
                background: 'var(--cat-security-bg)', color: 'var(--cat-security)',
                border: '1px solid var(--cat-security)', opacity: 0.9,
                flexShrink: 0,
              }}>
                🤖 AI · Scanned PDFs &amp; Images
              </span>
              {onSwitchToExtract && file?.type === 'application/pdf' && (
                <span style={{ fontSize: 11, opacity: 0.7 }}>
                  Digital PDF? <button
                    onClick={onSwitchToExtract}
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--cat-convert)', fontWeight: 700, fontSize: 11, textDecoration: 'underline' }}
                  >Use Extract Text →</button> (faster)
                </span>
              )}
            </div>
          </div>

          {processing && (
            <ProgressBar progress={progress} label={statusMsg} />
          )}

          <ActionRow>
            <button className="btn btn-primary" disabled={processing} onClick={runOcr}>
              {processing ? 'Recognising...' : 'Run OCR'}
            </button>
            {text && (
              <button className="btn btn-secondary" onClick={copyText}>
                Copy text
              </button>
            )}
            <button className="btn btn-secondary" onClick={handleReset}>
              Choose another file
            </button>
          </ActionRow>

          {text && (
            <div className="result-area">
              <h3>Extracted text</h3>
              <div className="result-text">{text}</div>
            </div>
          )}

          {!processing && statusMsg && !text && (
            <div className="progress-text" style={{ marginTop: '0.5rem' }}>{statusMsg}</div>
          )}
        </>
      )}
    </div>
  );
}
