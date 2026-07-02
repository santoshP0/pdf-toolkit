import { useState } from 'react';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import usePdfTool from './shared/usePdfTool';
import { Dropzone, FileInfo, ActionRow } from './shared/PdfToolUI';

export default function PageNumbers() {
  const {
    file, pageCount, processing, setProcessing,
    dragOver, inputRef, dropzoneProps, onInputChange, reset, exportPdfBytes, hasFile,
  } = usePdfTool();

  const [position, setPosition] = useState('bottom-center');
  const [fontSize, setFontSize] = useState(12);
  const [startNum, setStartNum] = useState(1);
  const [format, setFormat] = useState('plain');

  const stamp = async () => {
    if (!file) return;
    setProcessing(true);
    try {
      const bytes = await file.arrayBuffer();
      const doc = await PDFDocument.load(bytes);
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const pages = doc.getPages();
      const [vPos, hPos] = position.split('-');

      pages.forEach((page, i) => {
        const num = startNum + i;
        let label = String(num);
        if (format === 'dash') label = `- ${num} -`;
        else if (format === 'of') label = `${num} of ${pages.length + startNum - 1}`;
        else if (format === 'page') label = `Page ${num}`;

        const { width, height } = page.getSize();
        const textWidth = font.widthOfTextAtSize(label, fontSize);

        let x, y;
        if (hPos === 'left') x = 40;
        else if (hPos === 'right') x = width - textWidth - 40;
        else x = (width - textWidth) / 2;

        if (vPos === 'top') y = height - 40;
        else y = 30;

        page.drawText(label, { x, y, size: fontSize, font, color: rgb(0.3, 0.3, 0.3) });
      });

      const pdfBytes = await doc.save();
      exportPdfBytes(pdfBytes, 'numbered.pdf');
      setPosition('bottom-center');
      setFontSize(12);
      setStartNum(1);
      setFormat('plain');
    } catch (err) {
      alert('Error: ' + err.message);
      setProcessing(false);
    }
  };

  return (
    <div>
      {!hasFile ? (
        <Dropzone
          dragOver={dragOver}
          dropzoneProps={dropzoneProps}
          inputRef={inputRef}
          onInputChange={onInputChange}
          icon={'#\uFE0F\u20E3'}
        />
      ) : (
        <>
          <FileInfo file={file} pageCount={pageCount} onRemove={reset} />

          <div className="controls">
            <h3>Number settings</h3>
            <div className="control-row">
              <span className="control-label">Position</span>
              <select className="control-select" value={position} onChange={e => setPosition(e.target.value)}>
                <option value="bottom-left">Bottom Left</option>
                <option value="bottom-center">Bottom Center</option>
                <option value="bottom-right">Bottom Right</option>
                <option value="top-left">Top Left</option>
                <option value="top-center">Top Center</option>
                <option value="top-right">Top Right</option>
              </select>
            </div>
            <div className="control-row">
              <span className="control-label">Font size</span>
              <input
                className="control-input"
                type="number"
                min={6}
                max={36}
                value={fontSize}
                onChange={e => setFontSize(Number(e.target.value))}
                style={{ width: 70 }}
              />
            </div>
            <div className="control-row">
              <span className="control-label">Start at</span>
              <input
                className="control-input"
                type="number"
                min={0}
                value={startNum}
                onChange={e => setStartNum(Number(e.target.value))}
                style={{ width: 70 }}
              />
            </div>
            <div className="control-row">
              <span className="control-label">Format</span>
              <select className="control-select" value={format} onChange={e => setFormat(e.target.value)}>
                <option value="plain">1, 2, 3...</option>
                <option value="dash">- 1 -, - 2 -...</option>
                <option value="of">1 of N</option>
                <option value="page">Page 1, Page 2...</option>
              </select>
            </div>
          </div>

          <ActionRow>
            <button className="btn btn-primary" disabled={processing} onClick={stamp}>
              {processing ? 'Processing...' : 'Add Page Numbers'}
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
