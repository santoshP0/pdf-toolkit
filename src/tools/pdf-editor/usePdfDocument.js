import { useState, useEffect, useRef, useCallback } from 'react';
import { savePDFToDB, loadPDFFromDB, clearPDFFromDB } from '../PdfEditorDB';
import { detectFontFamily, detectFontWeight } from './helpers';

/* ================================================================
   PDF.js dynamic loader
   ================================================================ */
let _pdfjsCache = null;
function getPdfjsLib() {
  if (_pdfjsCache) return Promise.resolve(_pdfjsCache);
  return import('pdfjs-dist').then(mod => {
    if (!mod.GlobalWorkerOptions.workerSrc) {
      mod.GlobalWorkerOptions.workerSrc =
        `https://unpkg.com/pdfjs-dist@${mod.version}/build/pdf.worker.min.mjs`;
    }
    _pdfjsCache = mod;
    return mod;
  });
}

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
    setFile({ name });
    setLoading(true);
    setAnnotations(initialAnns || {});
    setCurrentPage(initialPage || 1);
    setSelectedIdx(null);
    setHistory([]);
    setHistoryIdx(-1);
    setThumbnails({});
    if (initialZoom) {
      setZoom(initialZoom);
    }
    try {
      const pdfjsLib = await getPdfjsLib();
      if (!bytes && f) {
        bytes = new Uint8Array(await f.arrayBuffer());
      }
      if (!bytes) return;

      pdfBytesRef.current = bytes;
      setPdfBytes(bytes);

      // Save PDF to DB asynchronously
      savePDFToDB(bytes, name);

      const clonedU8 = new Uint8Array(bytes.slice(0));
      const doc = await pdfjsLib.getDocument({ data: clonedU8 }).promise;
      setPdfDoc(doc);
      setTotalPages(doc.numPages);
      pushHistory(initialAnns || {});
    } catch (err) {
      alert('Error loading PDF: ' + err.message);
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
          const savedPage = localStorage.getItem('pdf_editor_current_page');
          const savedAnns = localStorage.getItem('pdf_editor_annotations');
          const savedZoom = localStorage.getItem('pdf_editor_zoom');

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
      const off = new OffscreenCanvas(vp.width, vp.height);
      await page.render({ canvasContext: off.getContext('2d'), viewport: vp }).promise;
      if (cancelled || !canvasRef.current) return;
      // Commit to visible canvas only after render completes
      canvas.width = vp.width;
      canvas.height = vp.height;
      canvas.getContext('2d').drawImage(off, 0, 0);
      setPageSize({ width: vp.width, height: vp.height });
      setPageReady(true);
    })();
    return () => { cancelled = true; };
  }, [pdfDoc, currentPage, renderScale, canvasRef]);

  /* ================================================================
     Extract text items from PDF for click-to-edit + alignment
     ================================================================ */
  useEffect(() => {
    if (!pdfDoc) { setPdfTextItems([]); return; }
    let cancelled = false;
    (async () => {
      try {
        const page = await pdfDoc.getPage(currentPage);
        const vp = page.getViewport({ scale: renderScale });
        const tc = await page.getTextContent();
        if (cancelled) return;
        const styles = tc.styles || {};

        // First pass: convert raw items to scaled coordinates
        const rawItems = tc.items.map(it => {
          const tx = it.transform;
          const fontSize = Math.round(Math.abs(tx[3]) * renderScale);
          const x = tx[4] * renderScale;
          const y = vp.height - tx[5] * renderScale;
          const width = it.width * renderScale;
          const height = it.height * renderScale;
          const fn = it.fontName || '';
          const styleInfo = styles[fn];
          const actualFamily = styleInfo?.fontFamily || '';
          const detFont = [
            fn ? `"${fn}"` : null,
            actualFamily ? `"${actualFamily}"` : null,
            detectFontFamily(actualFamily || fn)
          ].filter(Boolean).join(', ');
          const detectedWeight = detectFontWeight(fn, actualFamily);
          return {
            str: it.str || '', x, y, width, height, fontSize,
            fontName: fn, actualFamily, detectedFont: detFont,
            isBold: /bold/i.test(fn) || /bold/i.test(actualFamily) || detectedWeight >= 600,
            isItalic: /italic|oblique/i.test(fn) || /italic|oblique/i.test(actualFamily),
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

          // Build merged string with proper spacing
          let mergedStr = '';
          for (let k = 0; k < lineGroup.length; k++) {
            if (k > 0) {
              const prev = lineGroup[k - 1];
              const gap = lineGroup[k].x - (prev.x + prev.width);
              if (gap > 1) mergedStr += ' ';
            }
            mergedStr += lineGroup[k].str;
          }
          if (!mergedStr.trim()) continue;

          const minX = Math.min(...lineGroup.map(it => it.x));
          const maxRight = Math.max(...lineGroup.map(it => it.x + it.width));
          const maxHeight = Math.max(...lineGroup.map(it => it.height));
          mergedLines.push({
            str: mergedStr,
            x: minX, y: ref.y,
            width: maxRight - minX,
            height: maxHeight,
            fontSize: ref.fontSize,
            fontName: ref.fontName,
            actualFamily: ref.actualFamily,
            detectedFont: ref.detectedFont,
            isBold: ref.isBold,
            isItalic: ref.isItalic,
            fontWeight: ref.fontWeight,
            baseline: ref.baseline,
            isLine: true,
          });
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
    localStorage.removeItem('pdf_editor_annotations');
    localStorage.removeItem('pdf_editor_current_page');
    localStorage.removeItem('pdf_editor_zoom');

    setFile(null);
    setPdfDoc(null);
    setAnnotations({});
    setHistory([{}]);
    setHistoryIdx(0);
    setPdfBytes(null);
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
    pdfTextItems,
    thumbnails,
    showThumbs, setShowThumbs,
    loadFile,
    doClearWorkspace,
  };
}
