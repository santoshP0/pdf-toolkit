import { storage } from '../shared/storage';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  savePDFToDB, loadPDFFromDB, clearPDFFromDB,
  clearPDFEditorLocalStorage, PDF_EDITOR_UPDATED_AT_KEY,
} from '../PdfEditorDB';
import { compactStoredNoteCards, detectFontMatch, detectFontWeight } from './helpers';

/* ================================================================
   PDF.js dynamic loader
   ================================================================ */
import { getPdfjsLib } from '../shared/pdfjs';

/* ================================================================
   usePdfDocument hook
   Owns: file, pdfDoc, pdfBytes, totalPages, currentPage, pageSize,
         renderScale, loading, pageReady, pdfTextItems, thumbnails, showThumbs
   ================================================================ */
export default function usePdfDocument({ canvasRef, setAnnotations, setHistory, setHistoryIdx, setSelectedIdx, setZoom, pushHistory }) {
  /* File & PDF state */
  const [file, setFile] = useState(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pdfBytes, setPdfBytes] = useState(null);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });
  const [renderScale] = useState(1.5);
  const [loading, setLoading] = useState(false);
  const [pageReady, setPageReady] = useState(false);
  const [documentError, setDocumentError] = useState('');
  const [pdfTextItems, setPdfTextItems] = useState([]);
  const [thumbnails, setThumbnails] = useState({});
  const [showThumbs, setShowThumbs] = useState(false);

  const pdfBytesRef = useRef(null);

  /* ================================================================
     File loading
     ================================================================ */
  const loadFile = useCallback(async (f, savedBytes = null, savedName = null, initialAnns = null, initialPage = null, initialZoom = null) => {
    let name = savedName;
    let bytes = savedBytes;
    if (f) {
      if (f.type !== 'application/pdf') return;
      name = f.name;
    }
    setFile({ name, size: f?.size ?? savedBytes?.byteLength });
    setLoading(true);
    setDocumentError('');
    const restoredAnnotations = compactStoredNoteCards(initialAnns || {});
    setAnnotations(restoredAnnotations);
    setCurrentPage(initialPage || 1);
    setSelectedIdx(null);
    setHistory([]);
    setHistoryIdx(-1);
    setThumbnails({});
    if (Number.isFinite(initialZoom)) {
      setZoom(Math.min(4, Math.max(0.25, initialZoom)));
    }
    try {
      const pdfjsLib = await getPdfjsLib();
      if (!bytes && f) {
        bytes = new Uint8Array(await f.arrayBuffer());
      }
      if (!bytes) return;

      pdfBytesRef.current = bytes;
      setPdfBytes(bytes);

      const clonedU8 = new Uint8Array(bytes.slice(0));
      const doc = await pdfjsLib.getDocument({ data: clonedU8 }).promise;
      setPdfDoc(doc);
      setTotalPages(doc.numPages);
      setCurrentPage(Number.isInteger(initialPage) ? Math.min(doc.numPages, Math.max(1, initialPage)) : 1);
      pushHistory(restoredAnnotations);
      // Persist only after a valid PDF has opened successfully.
      savePDFToDB(bytes, name);
      storage.setItem(PDF_EDITOR_UPDATED_AT_KEY, Date.now().toString());
    } catch (err) {
      alert('Error loading PDF: ' + err.message);
      setFile(null);
      setPdfDoc(null);
      setPdfBytes(null);
      pdfBytesRef.current = null;
    } finally {
      setLoading(false);
    }
  }, [setAnnotations, setHistory, setHistoryIdx, setSelectedIdx, setZoom, pushHistory]);

  // Restore session from IndexedDB and localStorage on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = await loadPDFFromDB();
        if (cancelled) return;
        if (saved && saved.bytes && saved.name) {
          const savedPage = storage.getItem('pdf_editor_current_page');
          const savedAnns = storage.getItem('pdf_editor_annotations');
          const savedZoom = storage.getItem('pdf_editor_zoom');

          let initialPage = 1;
          if (savedPage) initialPage = parseInt(savedPage, 10);

          let initialAnns = {};
          if (savedAnns) {
            try {
              initialAnns = JSON.parse(savedAnns);
            } catch (e) {
              console.error('Failed to parse saved annotations:', e);
            }
          }

          let initialZoom = 1.0;
          if (savedZoom) initialZoom = parseFloat(savedZoom);

          if (!cancelled) await loadFile(null, saved.bytes, saved.name, initialAnns, initialPage, initialZoom);
        }
      } catch (e) {
        console.error('Error loading saved PDF session:', e);
      }
    })();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ================================================================
     Render PDF page
     ================================================================ */
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;
    let cancelled = false;
    setPageReady(false);
    (async () => {
      const page = await pdfDoc.getPage(currentPage);
      if (cancelled) return;
      const vp = page.getViewport({ scale: renderScale });
      const canvas = canvasRef.current;
      if (!canvas || cancelled) return;
      // Use offscreen canvas to render, then copy — avoids flicker and
      // prevents concurrent renders from corrupting the visible canvas
      const off = document.createElement('canvas');
      off.width = vp.width;
      off.height = vp.height;
      await page.render({ canvasContext: off.getContext('2d'), viewport: vp }).promise;
      if (cancelled || !canvasRef.current) return;
      // Commit to visible canvas only after render completes
      canvas.width = vp.width;
      canvas.height = vp.height;
      canvas.getContext('2d').drawImage(off, 0, 0);
      setPageSize({ width: vp.width, height: vp.height });
      setPageReady(true);
      setDocumentError('');
    })().catch(error => {
      if (!cancelled) setDocumentError(`This page could not be rendered: ${error.message}`);
    });
    return () => { cancelled = true; };
  }, [pdfDoc, currentPage, renderScale, canvasRef]);

  /* ================================================================
     Extract text items from PDF for click-to-edit + alignment
     ================================================================ */
  useEffect(() => {
    if (!pdfDoc) return;
    let cancelled = false;
    (async () => {
      try {
        const page = await pdfDoc.getPage(currentPage);
        const vp = page.getViewport({ scale: renderScale });
        const tc = await page.getTextContent();
        if (cancelled) return;
        const styles = tc.styles || {};
        const measureContext = document.createElement('canvas').getContext('2d');
        const fontMetadata = new Map();

        const getFontMetadata = (fontName) => {
          if (!fontName) return {};
          if (fontMetadata.has(fontName)) return fontMetadata.get(fontName);
          let metadata = {};
          try {
            // PDF.js resolves embedded/system font objects while extracting
            // text. This mirrors the family it uses to paint the PDF, while
            // remaining optional if a future PDF.js version hides the object.
            if (page.commonObjs?.has?.(fontName)) {
              const fontObj = page.commonObjs.get(fontName);
              metadata = {
                exactCss: fontObj.systemFontInfo?.css || '',
                loadedName: fontObj.loadedName || fontName,
                cssFontFamily: fontObj.cssFontInfo?.fontFamily || '',
                names: [fontObj.name, fontObj.systemFontInfo?.baseFontName].filter(Boolean),
                bold: Boolean(fontObj.bold || fontObj.black),
                italic: Boolean(fontObj.italic),
                vertical: Boolean(fontObj.vertical),
              };
            }
          } catch {
            // Public text metadata below remains a safe fallback.
          }
          fontMetadata.set(fontName, metadata);
          return metadata;
        };

        // First pass: convert raw items to scaled coordinates
        const rawItems = tc.items.map(it => {
          const tx = it.transform;
          const preciseFontSize = Math.hypot(tx[2], tx[3]) * renderScale;
          const fontSize = Math.max(1, Math.round(preciseFontSize));
          const x = tx[4] * renderScale;
          const y = vp.height - tx[5] * renderScale;
          const width = it.width * renderScale;
          const height = it.height * renderScale;
          const fn = it.fontName || '';
          const styleInfo = styles[fn];
          const actualFamily = styleInfo?.fontFamily || '';
          const metadata = getFontMetadata(fn);
          const metadataNames = metadata.names || [];
          const detectedWeight = metadata.bold
            ? 700
            : detectFontWeight(`${fn} ${metadataNames.join(' ')}`, actualFamily);
          const isItalic = metadata.italic
            || /italic|oblique/i.test(`${fn} ${actualFamily} ${metadataNames.join(' ')}`);
          const fontMatch = detectFontMatch(fn, actualFamily, {
            context: measureContext,
            text: it.str || '',
            width,
            fontSize: preciseFontSize || fontSize,
            fontWeight: detectedWeight,
            fontStyle: isItalic ? 'italic' : 'normal',
            skipMetric: metadata.vertical || Math.abs(tx[1]) > 0.01 || Math.abs(tx[2]) > 0.01,
            exactCss: metadata.exactCss,
            loadedName: metadata.loadedName,
            cssFontFamily: metadata.cssFontFamily,
            metadataNames,
          });
          return {
            str: it.str || '', x, y, width, height, fontSize,
            fontName: fn, actualFamily, detectedFont: fontMatch.css,
            detectedFontLabel: fontMatch.label,
            detectedFontCategory: fontMatch.category,
            isBold: detectedWeight >= 600,
            isItalic,
            fontWeight: detectedWeight,
            baseline: y,
            hasEOL: it.hasEOL,
          };
        });

        // Second pass: group into lines using y-proximity
        // Items on same visual line have baselines within ~half font-size
        const mergedLines = [];
        const used = new Set();
        for (let i = 0; i < rawItems.length; i++) {
          if (used.has(i) || !rawItems[i].str.trim()) continue;
          const ref = rawItems[i];
          const tol = ref.fontSize * 0.5;
          const lineGroup = [ref];
          used.add(i);
          // Gather forward items on same baseline
          for (let j = i + 1; j < rawItems.length; j++) {
            if (used.has(j)) continue;
            const it = rawItems[j];
            if (Math.abs(it.baseline - ref.baseline) < tol) {
              if (it.str.trim()) lineGroup.push(it);
              used.add(j);
            } else if (it.baseline > ref.baseline + ref.fontSize) {
              break; // past this line vertically
            }
          }
          lineGroup.sort((a, b) => a.x - b.x);

          // Keep adjacent fragments together only while their font signature
          // matches. This prevents a bold label or bullet from deciding the
          // family/style for an otherwise different line.
          const chunks = [];
          for (const item of lineGroup) {
            const signature = [
              item.detectedFont, item.fontSize, item.fontWeight, item.isItalic ? 'i' : 'n',
            ].join('|');
            const current = chunks[chunks.length - 1];
            if (!current || current.signature !== signature) {
              chunks.push({ signature, items: [item] });
            } else {
              current.items.push(item);
            }
          }

          for (const chunk of chunks) {
            const items = chunk.items;
            const chunkRef = items[0];
            let mergedStr = '';
            for (let k = 0; k < items.length; k++) {
              if (k > 0) {
                const previous = items[k - 1];
                const gap = items[k].x - (previous.x + previous.width);
                if (gap > 1) mergedStr += ' ';
              }
              mergedStr += items[k].str;
            }
            if (!mergedStr.trim()) continue;

            const minX = Math.min(...items.map(item => item.x));
            const maxRight = Math.max(...items.map(item => item.x + item.width));
            const maxHeight = Math.max(...items.map(item => item.height));
            mergedLines.push({
              str: mergedStr,
              x: minX, y: chunkRef.y,
              width: maxRight - minX,
              height: maxHeight,
              fontSize: chunkRef.fontSize,
              fontName: chunkRef.fontName,
              actualFamily: chunkRef.actualFamily,
              detectedFont: chunkRef.detectedFont,
              detectedFontLabel: chunkRef.detectedFontLabel,
              detectedFontCategory: chunkRef.detectedFontCategory,
              isBold: chunkRef.isBold,
              isItalic: chunkRef.isItalic,
              fontWeight: chunkRef.fontWeight,
              baseline: chunkRef.baseline,
              isLine: true,
            });
          }
        }

        if (!cancelled) setPdfTextItems(mergedLines);
      } catch { if (!cancelled) setPdfTextItems([]); }
    })();
    return () => { cancelled = true; };
  }, [pdfDoc, currentPage, renderScale]);

  /* ================================================================
     Thumbnail generation
     ================================================================ */
  useEffect(() => {
    if (!pdfDoc || !showThumbs) return;
    let cancelled = false;
    (async () => {
      for (let i = 1; i <= pdfDoc.numPages; i++) {
        if (cancelled || thumbnails[i]) continue;
        try {
          const page = await pdfDoc.getPage(i);
          const vp = page.getViewport({ scale: 0.2 });
          const c = document.createElement('canvas');
          c.width = vp.width; c.height = vp.height;
          await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
          if (!cancelled) setThumbnails(prev => ({ ...prev, [i]: c.toDataURL() }));
        } catch { /* skip */ }
      }
    })();
    return () => { cancelled = true; };
  }, [pdfDoc, showThumbs, totalPages]); // eslint-disable-line

  /* ================================================================
     Clear workspace helper (called from interaction hook)
     ================================================================ */
  const doClearWorkspace = useCallback(async () => {
    await clearPDFFromDB();
    clearPDFEditorLocalStorage();

    setFile(null);
    setPdfDoc(null);
    setAnnotations({});
    setHistory([{}]);
    setHistoryIdx(0);
    setPdfBytes(null);
    pdfBytesRef.current = null;
    setPdfTextItems([]);
    setDocumentError('');
    setThumbnails({});
    setSelectedIdx(null);
  }, [setAnnotations, setHistory, setHistoryIdx, setSelectedIdx]);

  return {
    file, setFile,
    pdfDoc,
    pdfBytes,
    pdfBytesRef,
    totalPages,
    currentPage, setCurrentPage,
    pageSize,
    renderScale,
    loading,
    pageReady,
    documentError,
    pdfTextItems,
    thumbnails,
    showThumbs, setShowThumbs,
    loadFile,
    doClearWorkspace,
  };
}
