import { useState, useCallback } from 'react';
import { PDFDocument } from 'pdf-lib';
import usePdfTool from './shared/usePdfTool';
import { Dropzone, FileInfo, ProgressBar, ActionRow } from './shared/PdfToolUI';

export default function SplitPdf() {
  const [ranges, setRanges] = useState('');

  const tool = usePdfTool({ outputName: 'split.pdf' });
  const {
    file, pageCount, setPageCount,
    processing, setProcessing,
    progress, setProgress,
    dragOver, inputRef,
    loadFile: baseLoadFile,
    dropzoneProps, onInputChange,
    reset: baseReset,
    exportPdfBytes, hasFile,
  } = tool;

  const loadFile = useCallback(async (f) => {
    await baseLoadFile(f);
    if (f && f.type === 'application/pdf') {
      try {
        const bytes = await f.arrayBuffer();
        const doc = await PDFDocument.load(bytes);
        const count = doc.getPageCount();
        setPageCount(count);
        setRanges(`1-${count}`);
      } catch { /* handled by base */ }
    }
  }, [baseLoadFile, setPageCount]);

  const reset = useCallback(() => {
    baseReset();
    setRanges('');
  }, [baseReset]);

  const wrappedDropzoneProps = {
    ...dropzoneProps,
    onDrop: (e) => {
      e.preventDefault();
      loadFile(e.dataTransfer.files[0]);
    },
  };

  const wrappedOnInputChange = useCallback((e) => {
    loadFile(e.target.files[0]);
    e.target.value = '';
  }, [loadFile]);

  const parseRanges = (str, max) => {
    const parts = str.split(',').map(s => s.trim()).filter(Boolean);
    const pages = [];
    for (const part of parts) {
      if (part.includes('-')) {
        const [a, b] = part.split('-').map(Number);
        if (isNaN(a) || isNaN(b)) continue;
        for (let i = Math.max(1, a); i <= Math.min(max, b); i++) {
          if (!pages.includes(i - 1)) pages.push(i - 1);
        }
      } else {
        const n = Number(part);
        if (!isNaN(n) && n >= 1 && n <= max && !pages.includes(n - 1)) {
          pages.push(n - 1);
        }
      }
    }
    return pages;
  };

  const split = async () => {
    if (!file) return;
    setProcessing(true);
    setProgress(0);
    try {
      const bytes = await file.arrayBuffer();
      const srcDoc = await PDFDocument.load(bytes);
      const indices = parseRanges(ranges, pageCount);
      if (indices.length === 0) {
        alert('No valid pages specified');
        setProcessing(false);
        return;
      }
      const newDoc = await PDFDocument.create();
      const copiedPages = await newDoc.copyPages(srcDoc, indices);
      copiedPages.forEach((p, i) => {
        newDoc.addPage(p);
        setProgress(Math.round(((i + 1) / copiedPages.length) * 100));
      });
      const pdfBytes = await newDoc.save();
      exportPdfBytes(pdfBytes, 'split.pdf');
    } catch (err) {
      alert('Error splitting: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div>
      {!hasFile ? (
        <Dropzone
          dragOver={dragOver}
          dropzoneProps={wrappedDropzoneProps}
          inputRef={inputRef}
          onInputChange={wrappedOnInputChange}
          icon={'\u2702\uFE0F'}
          accept=".pdf"
        />
      ) : (
        <>
          <FileInfo file={file} pageCount={pageCount} onRemove={reset} />

          <div className="controls">
            <h3>Page ranges</h3>
            <div className="control-row">
              <span className="control-label">Pages</span>
              <input
                className="control-input"
                type="text"
                value={ranges}
                onChange={e => setRanges(e.target.value)}
                placeholder="e.g. 1-3, 5, 7-9"
                style={{ flex: 1 }}
              />
            </div>
            <div className="control-row">
              <span className="control-label" />
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                Use commas to separate ranges. Total pages: {pageCount}
              </span>
            </div>
          </div>

          {processing && <ProgressBar progress={progress} label="Splitting..." />}

          <ActionRow>
            <button className="btn btn-primary" disabled={processing || !ranges.trim()} onClick={split}>
              {processing ? 'Splitting...' : 'Split & Download'}
            </button>
            <button className="btn btn-secondary" onClick={reset}>
              Choose another file
            </button>
          </ActionRow>
        </>
      )}
    </div>
  );
}
