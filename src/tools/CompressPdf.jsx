import { useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import { formatSize } from './shared/format';
import usePdfTool from './shared/usePdfTool';
import { Dropzone, FileInfo, ProgressBar, ActionRow } from './shared/PdfToolUI';

export default function CompressPdf() {
  const {
    file, pageCount, processing, setProcessing, progress, setProgress,
    dragOver, inputRef, dropzoneProps, onInputChange, reset, exportBlob, hasFile,
  } = usePdfTool({ outputName: 'compressed.pdf' });

  const [result, setResult] = useState(null);

  const handleRemove = () => {
    setResult(null);
    reset();
  };

  const compress = async () => {
    if (!file) return;
    setProcessing(true);
    setProgress(0);
    setResult(null);
    try {
      const bytes = await file.arrayBuffer();
      const srcDoc = await PDFDocument.load(bytes);
      const newDoc = await PDFDocument.create();
      const totalPages = srcDoc.getPageCount();

      const indices = srcDoc.getPageIndices();
      const copiedPages = await newDoc.copyPages(srcDoc, indices);
      copiedPages.forEach((page, i) => {
        newDoc.addPage(page);
        setProgress(Math.round(((i + 1) / totalPages) * 100));
      });

      // Copy metadata
      const srcTitle = srcDoc.getTitle();
      const srcAuthor = srcDoc.getAuthor();
      const srcSubject = srcDoc.getSubject();
      if (srcTitle) newDoc.setTitle(srcTitle);
      if (srcAuthor) newDoc.setAuthor(srcAuthor);
      if (srcSubject) newDoc.setSubject(srcSubject);

      const pdfBytes = await newDoc.save();
      const originalSize = file.size;
      const newSize = pdfBytes.length;
      const saved = originalSize - newSize;
      const pct = originalSize > 0 ? ((saved / originalSize) * 100).toFixed(1) : 0;

      setResult({
        bytes: pdfBytes,
        originalSize,
        newSize,
        saved,
        pct: Number(pct),
      });
    } catch (err) {
      alert('Error compressing: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const download = () => {
    if (!result) return;
    const blob = new Blob([result.bytes], { type: 'application/pdf' });
    setResult(null);
    exportBlob(blob);
  };

  return (
    <div>
      {!hasFile ? (
        <Dropzone
          dragOver={dragOver}
          dropzoneProps={dropzoneProps}
          inputRef={inputRef}
          onInputChange={onInputChange}
          icon={'\uD83D\uDDDC\uFE0F'}
        />
      ) : (
        <>
          <FileInfo file={file} pageCount={pageCount} onRemove={handleRemove} />

          {processing && (
            <ProgressBar progress={progress} label="Compressing..." />
          )}

          {result && (
            <div className="result-area">
              <h3>Compression result</h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: '1rem',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.8rem',
                textAlign: 'center',
                padding: '0.75rem 0'
              }}>
                <div>
                  <div style={{ color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Original</div>
                  <div style={{ fontWeight: 600 }}>{formatSize(result.originalSize)}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Compressed</div>
                  <div style={{ fontWeight: 600 }}>{formatSize(result.newSize)}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Saved</div>
                  <div style={{ fontWeight: 600, color: result.saved > 0 ? '#5cb85c' : 'var(--text-muted)' }}>
                    {result.saved > 0 ? `-${result.pct}%` : 'No reduction'}
                  </div>
                </div>
              </div>
            </div>
          )}

          <ActionRow>
            {!result ? (
              <button className="btn btn-primary" disabled={processing} onClick={compress}>
                {processing ? 'Compressing...' : 'Compress PDF'}
              </button>
            ) : (
              <button className="btn btn-primary" onClick={download}>
                Download compressed PDF
              </button>
            )}
            <button className="btn btn-secondary" onClick={handleRemove}>
              Choose another file
            </button>
          </ActionRow>
        </>
      )}
    </div>
  );
}
