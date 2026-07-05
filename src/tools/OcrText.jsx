import { useState } from 'react';
import usePdfTool from './shared/usePdfTool';
import { loadPdfjsDoc, renderPageToCanvas } from './shared/pdfjs';
import { Dropzone, FileInfo, ProgressBar, ActionRow } from './shared/PdfToolUI';

export default function OcrText() {
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

    try {
      let imageSources = [];

      if (file.type === 'application/pdf') {
        const doc = await loadPdfjsDoc(await file.arrayBuffer());
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const { canvas } = await renderPageToCanvas(page, 2);
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

          {processing && (
            <ProgressBar progress={progress} label={statusMsg} />
          )}

          <ActionRow>
            <button className="btn btn-primary" disabled={processing} onClick={runOcr}>
              {processing ? 'Processing...' : 'Extract Text'}
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
