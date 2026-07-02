import { useState, useRef, useCallback } from 'react';
import { PDFDocument } from 'pdf-lib';
import { saveAs } from 'file-saver';

/**
 * Shared hook for all PDF tools.
 *
 * Options:
 *   multi        – accept multiple files (default false)
 *   acceptTypes  – MIME types to accept (default ['application/pdf'])
 *   outputName   – default export filename (default 'output.pdf')
 *   onLoad(f, bytes, doc) – called after each file loads successfully
 */
export default function usePdfTool(opts = {}) {
  const {
    multi = false,
    acceptTypes = ['application/pdf'],
    outputName = 'output.pdf',
  } = opts;

  /* ── State ── */
  const [file, setFile] = useState(multi ? [] : null);
  const [pageCount, setPageCount] = useState(multi ? 0 : 0);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef();

  /* ── File loading ── */
  const loadFile = useCallback(async (f) => {
    if (!f) return;
    const ok = acceptTypes.some(t =>
      t.includes('*') ? f.type.startsWith(t.replace('*', '')) : f.type === t
    );
    if (!ok) return;

    if (multi) {
      setFile(prev => [...prev, f]);
    } else {
      setFile(f);
      if (f.type === 'application/pdf') {
        try {
          const bytes = await f.arrayBuffer();
          const doc = await PDFDocument.load(bytes);
          setPageCount(doc.getPageCount());
        } catch { /* page count stays 0 */ }
      }
    }
  }, [multi, acceptTypes]);

  const loadFiles = useCallback((fileList) => {
    Array.from(fileList).forEach(f => loadFile(f));
  }, [loadFile]);

  /* ── Drag & drop ── */
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    if (multi) {
      loadFiles(e.dataTransfer.files);
    } else {
      loadFile(e.dataTransfer.files[0]);
    }
  }, [multi, loadFile, loadFiles]);

  const dropzoneProps = {
    onDragOver: (e) => { e.preventDefault(); setDragOver(true); },
    onDragLeave: () => setDragOver(false),
    onDrop: handleDrop,
    onClick: () => inputRef.current?.click(),
  };

  /* ── Reset ── */
  const reset = useCallback(() => {
    setFile(multi ? [] : null);
    setPageCount(0);
    setProcessing(false);
    setProgress(0);
  }, [multi]);

  /* ── Export helper ── */
  const exportBlob = useCallback((blob, name) => {
    saveAs(blob, name || outputName);
    reset();
  }, [outputName, reset]);

  const exportPdfBytes = useCallback((bytes, name) => {
    exportBlob(new Blob([bytes], { type: 'application/pdf' }), name || outputName);
  }, [outputName, exportBlob]);

  /* ── Input change handler ── */
  const onInputChange = useCallback((e) => {
    if (multi) {
      loadFiles(e.target.files);
    } else {
      loadFile(e.target.files[0]);
    }
    e.target.value = '';
  }, [multi, loadFile, loadFiles]);

  return {
    // State
    file, setFile,
    pageCount, setPageCount,
    processing, setProcessing,
    progress, setProgress,
    dragOver,
    inputRef,

    // Handlers
    loadFile, loadFiles,
    handleDrop, dropzoneProps,
    onInputChange,
    reset,
    exportBlob, exportPdfBytes,

    // Computed
    hasFile: multi ? file.length > 0 : !!file,
  };
}
