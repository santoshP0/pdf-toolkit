import { useEffect } from 'react';
import { clamp, moveAnn, ZOOM_MIN, ZOOM_MAX } from './helpers';

/* ================================================================
   usePdfKeyboard hook
   Self-contained keyboard shortcuts effect. Returns nothing.
   ================================================================ */
export default function usePdfKeyboard({
  selectedIdx,
  currentPage,
  totalPages,
  deleteAnn,
  duplicateAnn,
  undo,
  redo,
  fitToWidth,
  setAnnsH,
  setActiveTool,
  setSelectedIdx,
  setEditingText,
  setContextMenu,
  setZoom,
  setCurrentPage,
  setShowThumbs,
  setSpaceHeld,
  setIsPanning,
  copyAnn,
  pasteAnn,
  clipboard,
  setSearchOpen,
  searchInputRef,
  editingText,
}) {
  useEffect(() => {
    const onKey = (e) => {
      const ctrlK = e.ctrlKey || e.metaKey;
      // Ctrl/Cmd+F: open search — handled before the input guard so it also
      // overrides the browser find dialog while typing.
      if (ctrlK && e.key.toLowerCase() === 'f') {
        e.preventDefault(); setSearchOpen(true);
        requestAnimationFrame(() => searchInputRef.current?.focus());
        return;
      }

      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;

      const key = e.key.toLowerCase();
      const ctrl = e.ctrlKey || e.metaKey;

      // An edit session can remain active while a native picker or toolbar
      // temporarily owns focus. Never interpret typed note text as tool keys.
      if (editingText) {
        if (e.key === 'Escape') {
          setEditingText(null);
          setSelectedIdx(null);
          setContextMenu(null);
          e.preventDefault();
        }
        return;
      }

      if (e.code === 'Space' && !ctrl) {
        e.preventDefault(); setSpaceHeld(true); return;
      }

      const tm = { v: 'select', t: 'text', p: 'draw', h: 'highlight', r: 'rect', e: 'circle', l: 'line', a: 'arrow', x: 'eraser', n: 'note' };
      if (tm[key] && !ctrl && !e.shiftKey && !e.altKey) {
        setActiveTool(tm[key]); setSelectedIdx(null); e.preventDefault(); return;
      }

      if (ctrl && key === 'z' && !e.shiftKey) { undo(); e.preventDefault(); return; }
      if (ctrl && ((key === 'z' && e.shiftKey) || key === 'y')) { redo(); e.preventDefault(); return; }
      if (ctrl && key === 'd' && selectedIdx !== null) { duplicateAnn(selectedIdx); e.preventDefault(); return; }
      if (ctrl && key === 'c' && selectedIdx !== null) { copyAnn(selectedIdx, false); e.preventDefault(); return; }
      if (ctrl && key === 'x' && selectedIdx !== null) { copyAnn(selectedIdx, true); e.preventDefault(); return; }
      if (ctrl && key === 'v' && clipboard) { pasteAnn(); e.preventDefault(); return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIdx !== null) { deleteAnn(selectedIdx); e.preventDefault(); return; }

      if (e.key === 'Escape') {
        setSelectedIdx(null); setEditingText(null); setContextMenu(null); return;
      }

      if (ctrl && key === '0') { fitToWidth(); e.preventDefault(); return; }
      if (ctrl && key === '1') { setZoom(1); e.preventDefault(); return; }
      if (ctrl && key === 'l') { setShowThumbs(v => !v); e.preventDefault(); return; }

      if (e.key === 'PageDown') { setCurrentPage(p => Math.min(totalPages, p + 1)); setSelectedIdx(null); e.preventDefault(); return; }
      if (e.key === 'PageUp') { setCurrentPage(p => Math.max(1, p - 1)); setSelectedIdx(null); e.preventDefault(); return; }

      if (ctrl && (key === '=' || key === '+')) { setZoom(z => clamp(z + 0.1, ZOOM_MIN, ZOOM_MAX)); e.preventDefault(); return; }
      if (ctrl && key === '-') { setZoom(z => clamp(z - 0.1, ZOOM_MIN, ZOOM_MAX)); e.preventDefault(); return; }

      if (selectedIdx !== null && ['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        const step = e.shiftKey ? 10 : 1;
        const dx = key === 'arrowleft' ? -step : key === 'arrowright' ? step : 0;
        const dy = key === 'arrowup' ? -step : key === 'arrowdown' ? step : 0;
        setAnnsH(prev => {
          const list = [...(prev[currentPage] || [])];
          list[selectedIdx] = moveAnn(list[selectedIdx], dx, dy);
          return { ...prev, [currentPage]: list };
        });
        e.preventDefault();
      }
    };

    const onKeyUp = (e) => {
      if (e.code === 'Space') { setSpaceHeld(false); setIsPanning(false); }
    };

    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKeyUp); };
  }, [selectedIdx, currentPage, totalPages, deleteAnn, duplicateAnn, undo, redo,
      fitToWidth, setAnnsH, setActiveTool, setSelectedIdx, setEditingText,
      setContextMenu, setZoom, setCurrentPage, setShowThumbs, setSpaceHeld, setIsPanning,
      copyAnn, pasteAnn, clipboard, setSearchOpen, searchInputRef, editingText]);
}
