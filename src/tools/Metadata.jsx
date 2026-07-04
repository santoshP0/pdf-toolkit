import { useState, useCallback } from 'react';
import { PDFDocument } from 'pdf-lib';
import usePdfTool from './shared/usePdfTool';
import { Dropzone, FileInfo, ActionRow } from './shared/PdfToolUI';

const FIELDS = [
  { key: 'title', label: 'Title' },
  { key: 'author', label: 'Author' },
  { key: 'subject', label: 'Subject' },
  { key: 'keywords', label: 'Keywords' },
  { key: 'creator', label: 'Creator' },
  { key: 'producer', label: 'Producer' },
];

const EMPTY = { title: '', author: '', subject: '', keywords: '', creator: '', producer: '' };

export default function Metadata() {
  const {
    file, setFile, pageCount, setPageCount,
    processing, setProcessing,
    dragOver, inputRef, dropzoneProps, reset, exportPdfBytes, hasFile,
  } = usePdfTool();

  const [meta, setMeta] = useState(EMPTY);

  const loadFile = useCallback(async (f) => {
    if (!f || f.type !== 'application/pdf') return;
    setFile(f);
    try {
      const doc = await PDFDocument.load(await f.arrayBuffer());
      setPageCount(doc.getPageCount());
      setMeta({
        title: doc.getTitle() || '',
        author: doc.getAuthor() || '',
        subject: doc.getSubject() || '',
        keywords: (doc.getKeywords() || '').toString(),
        creator: doc.getCreator() || '',
        producer: doc.getProducer() || '',
      });
    } catch (err) {
      alert('Error reading metadata: ' + err.message);
      reset();
    }
  }, [setFile, setPageCount, reset]);

  const customDropzoneProps = {
    ...dropzoneProps,
    onDrop: (e) => { e.preventDefault(); loadFile(e.dataTransfer.files[0]); },
  };

  const onInputChange = useCallback((e) => {
    loadFile(e.target.files[0]);
    e.target.value = '';
  }, [loadFile]);

  const setField = useCallback((key, value) => {
    setMeta(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleReset = useCallback(() => {
    reset();
    setMeta(EMPTY);
  }, [reset]);

  const save = useCallback(async () => {
    if (!file) return;
    setProcessing(true);
    try {
      const doc = await PDFDocument.load(await file.arrayBuffer());
      doc.setTitle(meta.title);
      doc.setAuthor(meta.author);
      doc.setSubject(meta.subject);
      doc.setKeywords(meta.keywords ? meta.keywords.split(',').map(k => k.trim()).filter(Boolean) : []);
      doc.setCreator(meta.creator);
      doc.setProducer(meta.producer);
      doc.setModificationDate(new Date());
      exportPdfBytes(await doc.save(), 'metadata.pdf');
      setMeta(EMPTY);
    } catch (err) {
      alert('Error: ' + err.message);
      setProcessing(false);
    }
  }, [file, meta, setProcessing, exportPdfBytes]);

  return (
    <div>
      {!hasFile ? (
        <Dropzone
          dragOver={dragOver}
          dropzoneProps={customDropzoneProps}
          inputRef={inputRef}
          onInputChange={onInputChange}
          icon={'🏷️'}
        />
      ) : (
        <>
          <FileInfo file={file} pageCount={pageCount} onRemove={handleReset} />

          <div className="controls">
            <h3>Document properties</h3>
            {FIELDS.map(({ key, label }) => (
              <div className="control-row" key={key}>
                <span className="control-label">{label}</span>
                <input
                  className="control-input"
                  type="text"
                  value={meta[key]}
                  placeholder={key === 'keywords' ? 'comma, separated, words' : `— no ${label.toLowerCase()} —`}
                  onChange={e => setField(key, e.target.value)}
                  style={{ flex: 1, minWidth: 180 }}
                />
              </div>
            ))}
          </div>

          <ActionRow>
            <button className="btn btn-primary" disabled={processing} onClick={save}>
              {processing ? 'Saving...' : 'Save Metadata'}
            </button>
            <button className="btn btn-secondary" onClick={handleReset}>
              Choose another file
            </button>
          </ActionRow>
        </>
      )}
    </div>
  );
}
