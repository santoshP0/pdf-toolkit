import { useState, useReducer, useCallback } from 'react';
import { DEFAULT_FONT_CSS, MAX_HISTORY } from './helpers';

const snapshot = value => JSON.parse(JSON.stringify(value));
const resolveUpdate = (update, previous) => typeof update === 'function' ? update(previous) : update;

function historyReducer(state, action) {
  if (action.type === 'setAnnotations') {
    return { ...state, annotations: resolveUpdate(action.value, state.annotations) };
  }
  if (action.type === 'setHistory') {
    return { ...state, history: resolveUpdate(action.value, state.history) };
  }
  if (action.type === 'setHistoryIdx') {
    return { ...state, historyIdx: resolveUpdate(action.value, state.historyIdx) };
  }
  if (action.type === 'edit' || action.type === 'checkpoint') {
    const annotations = action.type === 'edit'
      ? resolveUpdate(action.value, state.annotations)
      : (action.value ?? state.annotations);
    const history = [...state.history.slice(0, state.historyIdx + 1), snapshot(annotations)].slice(-MAX_HISTORY);
    return { annotations, history, historyIdx: history.length - 1 };
  }
  if (action.type === 'undo' || action.type === 'redo') {
    const index = state.historyIdx + (action.type === 'undo' ? -1 : 1);
    if (index < 0 || index >= state.history.length) return state;
    return { ...state, annotations: snapshot(state.history[index]), historyIdx: index };
  }
  return state;
}

/* ================================================================
   usePdfHistory hook
   Owns: annotations, history, historyIdx, skipHistoryRef, selectedIdx
   ================================================================ */
export default function usePdfHistory({ selectedIdxRef, currentPageRef, FONT_OPTIONS }) {
  const [{ annotations, history, historyIdx }, dispatch] = useReducer(historyReducer, {
    annotations: {}, history: [], historyIdx: -1,
  });
  const setAnnotations = useCallback(value => dispatch({ type: 'setAnnotations', value }), []);
  const setHistory = useCallback(value => dispatch({ type: 'setHistory', value }), []);
  const setHistoryIdx = useCallback(value => dispatch({ type: 'setHistoryIdx', value }), []);
  const [selectedIdx, setSelectedIdx] = useState(null);

  /* Tool state that syncs with selected annotation */
  const [strokeColor, setStrokeColor] = useState('#1a1a1a');
  const [fillColor, setFillColor] = useState('transparent');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [textSize, setTextSize] = useState(18);
  const [selectedFont, setSelectedFont] = useState('auto');
  const [textBold, setTextBold] = useState(false);
  const [textItalic, setTextItalic] = useState(false);

  /* ================================================================
     History management
     ================================================================ */
  const pushHistory = useCallback((anns) => {
    dispatch({ type: 'checkpoint', value: anns });
  }, []);

  const setAnnsH = useCallback((updater) => {
    dispatch({ type: 'edit', value: updater });
  }, []);

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
        const detectedFont = list[idx].detectedFont || list[idx].fontFamily || DEFAULT_FONT_CSS;
        const resolved = val === 'auto'
          ? detectedFont
          : (FONT_OPTIONS.find(f => f.id === val)?.css || DEFAULT_FONT_CSS);
        list[idx] = {
          ...list[idx],
          fontFamily: resolved,
          detectedFont,
          fontSelection: val,
        };
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
    dispatch({ type: 'undo' });
    setSelectedIdx(null);
  }, []);

  const redo = useCallback(() => {
    dispatch({ type: 'redo' });
    setSelectedIdx(null);
  }, []);

  return {
    annotations, setAnnotations,
    history, setHistory,
    historyIdx, setHistoryIdx,
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
