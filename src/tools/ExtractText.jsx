import { useState, useCallback } from 'react';
import { saveAs } from 'file-saver';
import usePdfTool from './shared/usePdfTool';
import { loadPdfjsDoc } from './shared/pdfjs';
import { Dropzone, FileInfo, ProgressBar, ActionRow } from './shared/PdfToolUI';

export default function ExtractText() {
  const {
    file, setFile, pageCount, setPageCount,
    processing, setProcessing, progress, setProgress,
    dragOver, inputRef, dropzoneProps, reset, hasFile,
  } = usePdfTool();

  const [text, setText] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [pageBreaks, setPageBreaks] = useState(true);

  const loadFile = useCallback((f) => {
    if (!f || f.type !== 'application/pdf') return;
    setFile(f);
    setText('');
    setPageCount(0);
  }, [setFile, setPageCount]);

  const customDropzoneProps = {
    ...dropzoneProps,
    onDrop: (e) => { e.preventDefault(); loadFile(e.dataTransfer.files[0]); },
  };

  const onInputChange = useCallback((e) => {
    loadFile(e.target.files[0]);
    e.target.value = '';
  }, [loadFile]);

  const handleReset = useCallback(() => {
    reset();
    setText('');
    setStatusMsg('');
  }, [reset]);

  const extract = useCallback(async () => {
    if (!file) return;
    setProcessing(true);
    setProgress(0);
    setText('');
    setStatusMsg('Reading document...');
    try {
      const doc = await loadPdfjsDoc(await file.arrayBuffer());
      setPageCount(doc.numPages);
      let out = '';
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        // Rebuild lines from text items using their vertical position.
        let lastY = null;
        let line = '';
        const lines = [];
        for (const item of content.items) {
          const y = item.transform[5];
          if (lastY !== null && Math.abs(y - lastY) > 2) {
            lines.push(line);
            line = '';
          }
          line += item.str;
          if (item.hasEOL) { lines.push(line); line = ''; }
          lastY = y;
        }
        if (line) lines.push(line);
        if (pageBreaks && i > 1) out += `\n\n--- Page ${i} ---\n\n`;
        out += lines.join('\n');
        setProgress(Math.round((i / doc.numPages) * 100));
      }
      const trimmed = out.trim();
      setText(trimmed);
      setStatusMsg(trimmed ? 'Done!' : 'No selectable text found — this may be a scanned PDF (try OCR Text).');
    } catch (err) {
      alert('Error: ' + err.message);
      setStatusMsg('');
    } finally {
      setProcessing(false);
    }
  }, [file, pageBreaks, setProcessing, setProgress, setPageCount]);

  const copyText = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setStatusMsg('Copied to clipboard!');
      setTimeout(() => setStatusMsg(''), 2000);
    });
  }, [text]);

  const download = useCallback(() => {
    const base = file?.name?.replace(/\.pdf$/i, '') || 'extracted';
    saveAs(new Blob([text], { type: 'text/plain;charset=utf-8' }), `${base}.txt`);
  }, [text, file]);

  return (
    <div>
      {!hasFile ? (
        <Dropzone
          dragOver={dragOver}
          dropzoneProps={customDropzoneProps}
          inputRef={inputRef}
          onInputChange={onInputChange}
          icon={'📝'}
        />
      ) : (
        <>
          <FileInfo file={file} pageCount={pageCount} onRemove={handleReset} />

          <div className="controls">
            <div className="control-row">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={pageBreaks} onChange={e => setPageBreaks(e.target.checked)} />
                <span className="control-label" style={{ margin: 0 }}>Mark page breaks</span>
              </label>
            </div>
          </div>

          {processing && <ProgressBar progress={progress} label={statusMsg} />}

          <ActionRow>
            <button className="btn btn-primary" disabled={processing} onClick={extract}>
              {processing ? 'Extracting...' : 'Extract Text'}
            </button>
            {text && (
              <>
                <button className="btn btn-secondary" onClick={copyText}>Copy text</button>
                <button className="btn btn-secondary" onClick={download}>Download .txt</button>
              </>
            )}
            <button className="btn btn-secondary" onClick={handleReset}>Choose another file</button>
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
