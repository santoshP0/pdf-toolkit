import { useState, useRef, useCallback } from 'react';
import { getBounds, getHandleAt, hitTest, moveAnn, cloneAnn, SNAP_THRESHOLD } from './helpers';

/* ================================================================
   usePdfInteraction hook
   Owns: isDrawing, currentPath, shapeStart, shapePreview, draggingIdx,
         dragOffset, resizeDirection, resizeStartRef, editingText,
         isPanning, spaceHeld, hoveredTextItem, guides
   ================================================================ */
export default function usePdfInteraction({
  overlayRef, scrollRef, canvasRef,
  pageAnns, pageSize, currentPage,
  activeTool,
  strokeColor, setStrokeColor,
  strokeWidth, fillColor,
  textBold, textItalic, textSize, setTextSize,
  selectedFont, setSelectedFont,
  setStrokeWidth,
  setTextBold, setTextItalic,
  setSelectedIdx,
  pdfTextItems,
  addAnn, deleteAnn,
  pushHistory,
  setAnnotations,
  computeGuides,
  findTextItemAt,
  findNearestTextItem,
  setActiveTool,
  setConfirmModal,
  doClearWorkspace,
  FONT_OPTIONS: FONTS,
  selectedIdx,
}) {

  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState([]);
  const [shapeStart, setShapeStart] = useState(null);
  const [shapePreview, setShapePreview] = useState(null);
  const [editingText, setEditingText] = useState(null);
  const [draggingIdx, setDraggingIdx] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizeDirection, setResizeDirection] = useState(null);
  const resizeStartRef = useRef(null);
  const [isPanning, setIsPanning] = useState(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const panStartRef = useRef(null);
  const panScrollRef = useRef(null);
  const [hoveredTextItem, setHoveredTextItem] = useState(null);
  const [guides, setGuides] = useState({ h: [], v: [] });

  /* ------------------------------------------------------------------ */
  const getPos = useCallback((e) => {
    const ol = overlayRef.current;
    if (!ol) return { x: 0, y: 0 };
    const r = ol.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (pageSize.width / r.width),
      y: (e.clientY - r.top) * (pageSize.height / r.height),
    };
  }, [pageSize, overlayRef]);

  /* ------------------------------------------------------------------ */
  const handlePointerDown = useCallback((e) => {
    if (spaceHeld || e.button === 1) {
      setIsPanning(true);
      panStartRef.current = { x: e.clientX, y: e.clientY };
      panScrollRef.current = {
        x: scrollRef.current?.scrollLeft || 0,
        y: scrollRef.current?.scrollTop || 0,
      };
      e.preventDefault();
      return;
    }

    const pos = getPos(e);

    if (activeTool === 'select') {
      // Check handles only on the currently selected annotation
      if (selectedIdx !== null && pageAnns[selectedIdx]) {
        const ann = pageAnns[selectedIdx];
        const handle = getHandleAt(ann, pos.x, pos.y);
        if (handle) {
          setResizeDirection(handle);
          setDraggingIdx(selectedIdx);
          const b = getBounds(ann);
          resizeStartRef.current = {
            pos,
            ann: JSON.parse(JSON.stringify(ann)),
            bounds: b,
            center: { x: b.x + b.w / 2, y: b.y + b.h / 2 }
          };
          overlayRef.current?.setPointerCapture?.(e.pointerId);
          return;
        }
      }

      for (let i = pageAnns.length - 1; i >= 0; i--) {
        if (hitTest(pageAnns[i], pos.x, pos.y)) {
          const ann = pageAnns[i];
          setSelectedIdx(i);
          setDraggingIdx(i);
          const b = getBounds(ann);
          setDragOffset({ x: pos.x - b.x, y: pos.y - b.y });
          overlayRef.current?.setPointerCapture?.(e.pointerId);
          if (ann.color) setStrokeColor(ann.color);
          if (ann.strokeWidth) setStrokeWidth(ann.strokeWidth);
          if (ann.type === 'text') {
            if (ann.fontSize) setTextSize(ann.fontSize);
            setTextBold(ann.fontWeight >= 700);
            setTextItalic(ann.fontStyle === 'italic');
            const matchFontOption = FONTS.find(f => f.css === ann.fontFamily);
            if (matchFontOption) setSelectedFont(matchFontOption.id);
            else setSelectedFont('auto');
          }
          return;
        }
      }
      setSelectedIdx(null);
      return;
    }

    if (activeTool === 'note') {
      // Re-edit an existing text/note if clicked; else start a new note.
      for (let i = pageAnns.length - 1; i >= 0; i--) {
        if (pageAnns[i].type === 'text' && hitTest(pageAnns[i], pos.x, pos.y)) {
          const ann = pageAnns[i];
          setEditingText({
            x: ann.x, y: ann.y,
            value: ann.text, originalValue: ann.text, editIdx: i,
            matchedFontSize: ann.fontSize,
            matchedBold: ann.fontWeight >= 700,
            matchedItalic: ann.fontStyle === 'italic',
            matchedColor: ann.color,
            note: !!ann.note,
            clickX: pos.x,
          });
          setSelectedIdx(null);
          return;
        }
      }
      setEditingText({ x: pos.x, y: pos.y, value: '', note: true, matchedBold: textBold, matchedItalic: textItalic });
      setSelectedIdx(null);
      return;
    }

    if (activeTool === 'text') {
      for (let i = pageAnns.length - 1; i >= 0; i--) {
        if (pageAnns[i].type === 'text' && hitTest(pageAnns[i], pos.x, pos.y)) {
          const ann = pageAnns[i];
          setEditingText({
            x: ann.x, y: ann.y,
            value: ann.text, originalValue: ann.text, editIdx: i,
            matchedFontSize: ann.fontSize,
            matchedBold: ann.fontWeight >= 700,
            matchedItalic: ann.fontStyle === 'italic',
            matchedColor: ann.color,
            note: !!ann.note,
            clickX: pos.x,
          });
          setSelectedIdx(null);
          return;
        }
      }

      const hit = findTextItemAt(pos.x, pos.y);
      if (hit) {
        let sampledColor = '#1a1a1a';
        if (canvasRef.current) {
          const ctx = canvasRef.current.getContext('2d');
          const cy = Math.round(hit.y - hit.height * 0.35);
          const sampleXs = [0.1, 0.2, 0.3, 0.5, 0.7].map(f => Math.round(hit.x + hit.width * f));
          let bestPixel = null, bestDarkness = 255 * 3;
          for (const sx of sampleXs) {
            const pixel = ctx.getImageData(sx, cy, 1, 1).data;
            const brightness = pixel[0] + pixel[1] + pixel[2];
            if (brightness > 700) continue;
            if (brightness < bestDarkness) { bestDarkness = brightness; bestPixel = pixel; }
          }
          if (bestPixel) {
            sampledColor = '#' + [bestPixel[0], bestPixel[1], bestPixel[2]].map(c => c.toString(16).padStart(2, '0')).join('');
          }
        }
        setTextSize(hit.fontSize);
        setStrokeColor(sampledColor);
        setEditingText({
          x: hit.x, y: hit.baseline,
          value: hit.str, originalValue: hit.str,
          matchedFontSize: hit.fontSize,
          matchedBold: hit.isBold, matchedItalic: hit.isItalic,
          matchedWeight: hit.fontWeight || 400,
          matchedColor: sampledColor, matchedFont: hit.detectedFont,
          pdfTextItem: hit, clickX: pos.x,
        });
        setSelectedIdx(null);
        setGuides({ h: [hit.baseline], v: [hit.x] });
        return;
      }

      const nearby = findNearestTextItem(pos.x, pos.y, 60);
      if (nearby) setTextSize(nearby.fontSize);
      const g = computeGuides(pos.x, pos.y);
      const sx = g.v.length > 0 ? g.v[0] : pos.x;
      const sy = g.h.length > 0 ? g.h[0] : pos.y;
      setGuides(g);
      setEditingText({ x: sx, y: sy, value: '', matchedBold: textBold, matchedItalic: textItalic });
      setSelectedIdx(null);
      return;
    }

    if (activeTool === 'eraser') {
      for (let i = pageAnns.length - 1; i >= 0; i--) {
        if (hitTest(pageAnns[i], pos.x, pos.y)) { deleteAnn(i); return; }
      }
      return;
    }

    overlayRef.current?.setPointerCapture?.(e.pointerId);
    setIsDrawing(true);
    setSelectedIdx(null);
    if (activeTool === 'draw' || activeTool === 'highlight') {
      setCurrentPath([pos]);
    } else {
      setShapeStart(pos);
    }
  }, [activeTool, pageAnns, selectedIdx, getPos, deleteAnn, spaceHeld, findTextItemAt,
      findNearestTextItem, computeGuides, setSelectedIdx, setStrokeColor,
      setStrokeWidth, setTextSize, setTextBold, setTextItalic, setSelectedFont,
      textBold, textItalic, FONTS, overlayRef, scrollRef, canvasRef]);

  /* ------------------------------------------------------------------ */
  const handlePointerMove = useCallback((e) => {
    if (isPanning && panStartRef.current && scrollRef.current) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      scrollRef.current.scrollLeft = panScrollRef.current.x - dx;
      scrollRef.current.scrollTop = panScrollRef.current.y - dy;
      return;
    }

    if (activeTool === 'text' && !isDrawing && !editingText && draggingIdx === null) {
      const pos = getPos(e);
      const hit = findTextItemAt(pos.x, pos.y);
      if (hit !== hoveredTextItem) setHoveredTextItem(hit);
    }

    if (draggingIdx !== null) {
      const pos = getPos(e);
      if (resizeDirection) {
        const start = resizeStartRef.current;
        if (!start) return;
        const ann = start.ann;
        const dx = pos.x - start.pos.x;
        const dy = pos.y - start.pos.y;
        let nextAnn = { ...ann };
        if (resizeDirection === 'rotate') {
          const startAngle = Math.atan2(start.pos.y - start.center.y, start.pos.x - start.center.x);
          const currentAngle = Math.atan2(pos.y - start.center.y, pos.x - start.center.x);
          nextAnn.rotation = (ann.rotation || 0) + (currentAngle - startAngle);
        } else {
          if (ann.type === 'rect' || ann.type === 'circle') {
            let x = start.ann.x, y = start.ann.y, w = start.ann.w, h = start.ann.h;
            if (resizeDirection === 'nw') { x += dx; y += dy; w -= dx; h -= dy; }
            else if (resizeDirection === 'ne') { y += dy; w += dx; h -= dy; }
            else if (resizeDirection === 'sw') { x += dx; w -= dx; h += dy; }
            else if (resizeDirection === 'se') { w += dx; h += dy; }
            nextAnn.x = x; nextAnn.y = y; nextAnn.w = w; nextAnn.h = h;
          } else if (ann.type === 'text') {
            const scale = 1 + (resizeDirection.includes('e') ? dx : -dx) / Math.max(10, start.bounds.w);
            const nextSize = Math.max(8, Math.min(120, Math.round(start.ann.fontSize * scale)));
            nextAnn.fontSize = nextSize;
            // ponytail: scale note box by font ratio instead of remeasuring per-frame (stays snappy)
            if (start.ann.noteBg) {
              const f = nextSize / start.ann.fontSize;
              const nb = start.ann.noteBg;
              nextAnn.noteBg = { ...nb, y: nb.y + (start.ann.fontSize - nextSize), w: nb.w * f, h: nb.h * f };
            }
          } else if (ann.type === 'line' || ann.type === 'arrow') {
            if (resizeDirection === 'nw' || resizeDirection === 'sw') {
              nextAnn.x1 = start.ann.x1 + dx; nextAnn.y1 = start.ann.y1 + dy;
            } else {
              nextAnn.x2 = start.ann.x2 + dx; nextAnn.y2 = start.ann.y2 + dy;
            }
          } else if (ann.type === 'path' || ann.type === 'highlight') {
            const scaleX = 1 + dx / Math.max(10, start.bounds.w);
            const scaleY = 1 + dy / Math.max(10, start.bounds.h);
            nextAnn.points = start.ann.points.map(p => ({
              x: start.bounds.x + (p.x - start.bounds.x) * scaleX,
              y: start.bounds.y + (p.y - start.bounds.y) * scaleY
            }));
          }
        }
        setAnnotations(prev => {
          const list = [...(prev[currentPage] || [])];
          list[draggingIdx] = nextAnn;
          return { ...prev, [currentPage]: list };
        });
      } else {
        const targetX = pos.x - dragOffset.x;
        const targetY = pos.y - dragOffset.y;
        const g = computeGuides(targetX, targetY);
        setGuides(g);
        setAnnotations(prev => {
          const list = [...(prev[currentPage] || [])];
          const ann = list[draggingIdx];
          const b = getBounds(ann);
          let nx = pos.x - dragOffset.x;
          let ny = pos.y - dragOffset.y;
          if (g.v.length > 0) nx = g.v[0];
          if (g.h.length > 0) ny = g.h[0];
          list[draggingIdx] = moveAnn(ann, nx - b.x, ny - b.y);
          return { ...prev, [currentPage]: list };
        });
      }
      return;
    }

    if (!isDrawing) return;
    const pos = getPos(e);
    if (activeTool === 'draw' || activeTool === 'highlight') {
      setCurrentPath(prev => [...prev, pos]);
    } else if (activeTool === 'rect') {
      setShapePreview({ type: 'rect', x: shapeStart.x, y: shapeStart.y, w: pos.x - shapeStart.x, h: pos.y - shapeStart.y });
    } else if (activeTool === 'circle') {
      setShapePreview({ type: 'circle', x: shapeStart.x, y: shapeStart.y, w: pos.x - shapeStart.x, h: pos.y - shapeStart.y });
    } else if (activeTool === 'line') {
      setShapePreview({ type: 'line', x1: shapeStart.x, y1: shapeStart.y, x2: pos.x, y2: pos.y });
    } else if (activeTool === 'arrow') {
      setShapePreview({ type: 'arrow', x1: shapeStart.x, y1: shapeStart.y, x2: pos.x, y2: pos.y });
    }
  }, [isPanning, draggingIdx, isDrawing, activeTool, shapeStart, getPos, dragOffset,
      currentPage, computeGuides, editingText, findTextItemAt, hoveredTextItem,
      resizeDirection, setAnnotations, scrollRef]);

  /* ------------------------------------------------------------------ */
  const handlePointerUp = useCallback((e) => {
    if (isPanning) { setIsPanning(false); panStartRef.current = null; return; }
    if (draggingIdx !== null) {
      setAnnotations(prev => { pushHistory(prev); return prev; });
      setDraggingIdx(null);
      setResizeDirection(null);
      resizeStartRef.current = null;
      setGuides({ h: [], v: [] });
      overlayRef.current?.releasePointerCapture?.(e.pointerId);
      return;
    }
    if (!isDrawing) return;
    overlayRef.current?.releasePointerCapture?.(e.pointerId);
    if ((activeTool === 'draw' || activeTool === 'highlight') && currentPath.length > 1) {
      const sw = activeTool === 'highlight' ? Math.max(strokeWidth, 18) : strokeWidth;
      addAnn({ type: activeTool === 'highlight' ? 'highlight' : 'path', points: currentPath, color: strokeColor, strokeWidth: sw });
    } else if (['rect', 'circle', 'line', 'arrow'].includes(activeTool) && shapePreview) {
      addAnn({ ...shapePreview, color: strokeColor, strokeWidth, fillColor: ['rect', 'circle'].includes(activeTool) ? fillColor : undefined });
    }
    setIsDrawing(false);
    setCurrentPath([]);
    setShapeStart(null);
    setShapePreview(null);
  }, [isPanning, draggingIdx, isDrawing, activeTool, currentPath, shapePreview,
      strokeColor, fillColor, strokeWidth, addAnn, pushHistory, setAnnotations, overlayRef]);


  /* ------------------------------------------------------------------ */
  const handleDoubleClick = useCallback((e) => {
    const pos = getPos(e);
    for (let i = pageAnns.length - 1; i >= 0; i--) {
      if (pageAnns[i].type === 'text' && hitTest(pageAnns[i], pos.x, pos.y)) {
        const ann = pageAnns[i];
        setEditingText({
          x: ann.x, y: ann.y, value: ann.text, editIdx: i,
          matchedFontSize: ann.fontSize, matchedBold: ann.fontWeight >= 700,
          matchedItalic: ann.fontStyle === 'italic', matchedFont: ann.fontFamily,
          note: !!ann.note, clickX: pos.x,
        });
        setSelectedIdx(null);
        setActiveTool('text');
        return;
      }
    }
  }, [pageAnns, getPos, setSelectedIdx, setActiveTool]);

  /* ------------------------------------------------------------------ */
  const handleClearWorkspace = useCallback(() => {
    setConfirmModal({
      title: 'Open New File',
      message: "This will remove the current PDF and all annotations. Your changes won't be saved unless you export first.",
      confirmLabel: 'Continue',
      danger: true,
      onConfirm: doClearWorkspace,
    });
  }, [doClearWorkspace, setConfirmModal]);

  return {
    isDrawing, currentPath, shapeStart, shapePreview,
    editingText, setEditingText,
    draggingIdx, dragOffset,
    resizeDirection, resizeStartRef,
    isPanning, setIsPanning, spaceHeld, setSpaceHeld,
    hoveredTextItem,
    guides, setGuides,
    getPos,
    handlePointerDown, handlePointerMove, handlePointerUp,
    handleDoubleClick,
    handleClearWorkspace,
  };
}
