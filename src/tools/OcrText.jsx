import { useState, useRef } from 'react';

export default function OcrText() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState('');
  const [text, setText] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef();

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
    setDragOver(false);
    loadFile(e.dataTransfer.files[0]);
  };

  const runOcr = async () => {
    if (!file) return;
    setProcessing(true);
    setProgress(0);
    setText('');
    setStatusMsg('Loading OCR engine...');

    try {
      let imageSources = [];

      if (file.type === 'application/pdf') {
        const pdfjsMod = await import('pdfjs-dist');
        if (!pdfjsMod.GlobalWorkerOptions.workerSrc) {
          pdfjsMod.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsMod.version}/build/pdf.worker.min.mjs`;
        }
        const bytes = await file.arrayBuffer();
        const doc = await pdfjsMod.getDocument({ data: new Uint8Array(bytes) }).promise;
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const vp = page.getViewport({ scale: 2 });
          const canvas = document.createElement('canvas');
          canvas.width = vp.width;
          canvas.height = vp.height;
          const ctx = canvas.getContext('2d');
          await page.render({ canvasContext: ctx, viewport: vp }).promise;
          imageSources.push(canvas.toDataURL('image/png'));
        }
      } else {
        const dataUrl = await new Promise(resolve => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(file);
        });
        imageSources.push(dataUrl);
      }

      const Tesseract = await import('tesseract.js');
      let allText = '';

      for (let i = 0; i < imageSources.length; i++) {
        setStatusMsg(`Recognizing page ${i + 1} of ${imageSources.length}...`);
        const result = await Tesseract.recognize(imageSources[i], 'eng', {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              const pageProgress = (i + m.progress) / imageSources.length;
              setProgress(Math.round(pageProgress * 100));
            }
          }
        });
        allText += (i > 0 ? '\n\n--- Page ' + (i + 1) + ' ---\n\n' : '') + result.data.text;
      }

      setText(allText);
      setStatusMsg('Done!');
    } catch (err) {
      alert('OCR error: ' + err.message);
      setStatusMsg('');
    } finally {
      setProcessing(false);
    }
  };

  const copyText = () => {
    navigator.clipboard.writeText(text).then(() => {
      setStatusMsg('Copied to clipboard!');
      setTimeout(() => setStatusMsg(''), 2000);
    });
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
          <div className="dropzone-icon">{'🔍'}</div>
          <div className="dropzone-text">
            <strong>Drop a PDF or image here</strong> or click to browse
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,image/*"
            hidden
            onChange={e => { loadFile(e.target.files[0]); e.target.value = ''; }}
          />
        </div>
      ) : (
        <>
          <div className="file-list">
            <div className="file-item">
              <span className="file-name">{file.name}</span>
              <span className="file-size">{(file.size / 1024).toFixed(1)} KB</span>
              <button className="file-remove" onClick={() => { setFile(null); setText(''); setPreview(null); }}>{'\u00D7'}</button>
            </div>
          </div>

          {preview && (
            <div style={{ marginBottom: '1rem', textAlign: 'center' }}>
              <img src={preview} alt="Preview" style={{ maxWidth: '100%', maxHeight: 300, borderRadius: 4, border: '2px solid var(--sketch-text)' }} />
            </div>
          )}

          {processing && (
            <>
              <div className="progress-text">{statusMsg} {progress}%</div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>
            </>
          )}

          <div className="action-row">
            <button className="btn btn-primary" disabled={processing} onClick={runOcr}>
              {processing ? 'Processing...' : 'Extract Text'}
            </button>
            {text && (
              <button className="btn btn-secondary" onClick={copyText}>
                Copy text
              </button>
            )}
            <button className="btn btn-secondary" onClick={() => { setFile(null); setText(''); setPreview(null); }}>
              Choose another file
            </button>
          </div>

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
