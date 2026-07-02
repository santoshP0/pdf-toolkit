import { useState, useRef, useCallback } from 'react';
import { MAX_HISTORY } from './helpers';

/* ================================================================
   usePdfHistory hook
   Owns: annotations, history, historyIdx, skipHistoryRef, selectedIdx
   ================================================================ */
export default function usePdfHistory({ selectedIdxRef, currentPageRef, FONT_OPTIONS }) {
  const [annotations, setAnnotations] = useState({});
  const [history, setHistory] = useState([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const historyIdxRef = useRef(-1);
  const skipHistoryRef = useRef(false);
  const [selectedIdx, setSelectedIdx] = useState(null);

  /* Tool state that syncs with selected annotation */
  const [strokeColor, setStrokeColor] = useState('#1a1a1a');
  const [fillColor, setFillColor] = useState('transparent');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [textSize, setTextSize] = useState(18);
  const [selectedFont, setSelectedFont] = useState('auto');
  const [textBold, setTextBold] = useState(false);
  const [textItalic, setTextItalic] = useState(false);

  // Keep ref in sync with state
  historyIdxRef.current = historyIdx;

  /* ================================================================
     History management
     ================================================================ */
  const pushHistory = useCallback((anns) => {
    setHistory(prev => {
      const truncated = prev.slice(0, historyIdxRef.current + 1);
      const next = [...truncated, JSON.parse(JSON.stringify(anns))];
      if (next.length > MAX_HISTORY) next.shift();
      return next;
    });
    setHistoryIdx(prev => Math.min(prev + 1, MAX_HISTORY - 1));
  }, []);

  const pendingAnnsRef = useRef(null);

  const setAnnsH = useCallback((updater) => {
    setAnnotations(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      pendingAnnsRef.current = next;
      return next;
    });
    // Use queueMicrotask to ensure updater has run before we push history
    queueMicrotask(() => {
      if (!skipHistoryRef.current && pendingAnnsRef.current !== null) {
        pushHistory(pendingAnnsRef.current);
      }
      skipHistoryRef.current = false;
      pendingAnnsRef.current = null;
    });
  }, [pushHistory]);

  const syncAnnProp = useCallback((prop, val) => {
    const idx = selectedIdxRef.current;
    const pg = currentPageRef.current;
    if (idx === null) return;
    setAnnsH(prev => {
      const list = [...(prev[pg] || [])];
      if (list[idx]) list[idx] = { ...list[idx], [prop]: val };
      return { ...prev, [pg]: list };
    });
  }, [setAnnsH, selectedIdxRef, currentPageRef]);

  const setStrokeColorSync = useCallback((val) => {
    setStrokeColor(val);
    syncAnnProp('color', val);
  }, [syncAnnProp]);

  const setFillColorSync = useCallback((val) => {
    setFillColor(val);
    syncAnnProp('fillColor', val);
  }, [syncAnnProp]);

  const setStrokeWidthSync = useCallback((val) => {
    setStrokeWidth(val);
    syncAnnProp('strokeWidth', val);
  }, [syncAnnProp]);

  const setTextSizeSync = useCallback((val) => {
    setTextSize(val);
    const idx = selectedIdxRef.current;
    const pg = currentPageRef.current;
    if (idx === null) return;
    setAnnsH(prev => {
      const list = [...(prev[pg] || [])];
      if (list[idx] && list[idx].type === 'text') list[idx] = { ...list[idx], fontSize: val };
      return { ...prev, [pg]: list };
    });
  }, [setAnnsH, selectedIdxRef, currentPageRef]);

  const setSelectedFontSync = useCallback((val) => {
    setSelectedFont(val);
    const idx = selectedIdxRef.current;
    const pg = currentPageRef.current;
    if (idx === null) return;
    setAnnsH(prev => {
      const list = [...(prev[pg] || [])];
      if (list[idx] && list[idx].type === 'text') {
        const resolved = val === 'auto'
          ? (list[idx].detectedFont || '"Times New Roman", serif')
          : (FONT_OPTIONS.find(f => f.id === val)?.css || '"Times New Roman", serif');
        list[idx] = { ...list[idx], fontFamily: resolved };
      }
      return { ...prev, [pg]: list };
    });
  }, [setAnnsH, selectedIdxRef, currentPageRef, FONT_OPTIONS]);

  const setTextBoldSync = useCallback((val) => {
    setTextBold(val);
    const idx = selectedIdxRef.current;
    const pg = currentPageRef.current;
    if (idx === null) return;
    setAnnsH(prev => {
      const list = [...(prev[pg] || [])];
      if (list[idx] && list[idx].type === 'text') list[idx] = { ...list[idx], fontWeight: val ? 700 : 400 };
      return { ...prev, [pg]: list };
    });
  }, [setAnnsH, selectedIdxRef, currentPageRef]);

  const setTextItalicSync = useCallback((val) => {
    setTextItalic(val);
    const idx = selectedIdxRef.current;
    const pg = currentPageRef.current;
    if (idx === null) return;
    setAnnsH(prev => {
      const list = [...(prev[pg] || [])];
      if (list[idx] && list[idx].type === 'text') list[idx] = { ...list[idx], fontStyle: val ? 'italic' : 'normal' };
      return { ...prev, [pg]: list };
    });
  }, [setAnnsH, selectedIdxRef, currentPageRef]);

  const undo = useCallback(() => {
    if (historyIdx <= 0) return;
    const ni = historyIdx - 1;
    setHistoryIdx(ni);
    skipHistoryRef.current = true;
    setAnnotations(JSON.parse(JSON.stringify(history[ni])));
    setSelectedIdx(null);
  }, [history, historyIdx]);

  const redo = useCallback(() => {
    if (historyIdx >= history.length - 1) return;
    const ni = historyIdx + 1;
    setHistoryIdx(ni);
    skipHistoryRef.current = true;
    setAnnotations(JSON.parse(JSON.stringify(history[ni])));
    setSelectedIdx(null);
  }, [history, historyIdx]);

  return {
    annotations, setAnnotations,
    history, setHistory,
    historyIdx, setHistoryIdx,
    skipHistoryRef,
    selectedIdx, setSelectedIdx,
    /* Sync tool state */
    strokeColor, setStrokeColor,
    fillColor, setFillColor,
    strokeWidth, setStrokeWidth,
    textSize, setTextSize,
    selectedFont, setSelectedFont,
    textBold, setTextBold,
    textItalic, setTextItalic,
    /* History actions */
    pushHistory,
    setAnnsH,
    setStrokeColorSync,
    setFillColorSync,
    setStrokeWidthSync,
    setTextSizeSync,
    setSelectedFontSync,
    setTextBoldSync,
    setTextItalicSync,
    undo,
    redo,
  };
}
