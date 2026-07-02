import { useState, useRef, useEffect, useCallback, useMemo } from 'react';

import S from './pdf-editor/PdfEditorStyles';
import {
  COLORS, FONT_OPTIONS, ZOOM_MIN, ZOOM_MAX, ZOOM_STEP, SNAP_THRESHOLD,
  clamp, uid, getBounds, getHandleAt, hitTest, moveAnn, cloneAnn,
  parseRichText, hexToRgb,
} from './pdf-editor/helpers';
import usePdfHistory from './pdf-editor/usePdfHistory';
import usePdfDocument from './pdf-editor/usePdfDocument';
import usePdfInteraction from './pdf-editor/usePdfInteraction';
import usePdfKeyboard from './pdf-editor/usePdfKeyboard';
import usePdfExport from './pdf-editor/usePdfExport';
import PdfEditorTextOverlay from './PdfEditorTextOverlay';
import PdfEditorToolStrip, { TOOL_DEFS } from './PdfEditorToolStrip';
import PdfEditorLayersPanel from './PdfEditorLayersPanel';
import PdfEditorStatusBar from './PdfEditorStatusBar';
import { PdfEditorContextMenu, PdfEditorConfirmModal } from './PdfEditorModals';

export default function PdfEditor({ onBack, tool }) {
  /* ── UI-only state (not owned by any hook) ── */
  const [zoom, setZoom] = useState(1.0);
  const [activeTool, setActiveTool] = useState('select');
  const [dragOver, setDragOver] = useState(false);
  const [showLayers, setShowLayers] = useState(true);
  const [hoveredTool, setHoveredTool] = useState(null);
  const [toolStripWidth, setToolStripWidth] = useState(140);
  const toolStripResizing = useRef(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [clipboard, setClipboard] = useState(null);
  const [dragOverLayerIdx, setDragOverLayerIdx] = useState(null);

  /* ── Refs shared between hooks ── */
  const inputRef = useRef();
  const canvasRef = useRef();
  const overlayRef = useRef();
  const scrollRef = useRef();
  const textInputRef = useRef();
  const isInteractingWithToolbarRef = useRef(false);
  const rafRef = useRef(null);
  const selectedIdxRef = useRef(null);
  const currentPageRef = useRef(1);

  /* ── History hook (must come first — provides setAnnotations etc) ── */
  const history = usePdfHistory({ selectedIdxRef, currentPageRef, FONT_OPTIONS });
  const {
    annotations, setAnnotations,
    history: histArr, setHistory, historyIdx, setHistoryIdx,
    selectedIdx, setSelectedIdx,
    strokeColor, setStrokeColor,
    fillColor, setFillColor,
    strokeWidth, setStrokeWidth,
    textSize, setTextSize,
    selectedFont, setSelectedFont,
    textBold, setTextBold,
    textItalic, setTextItalic,
    pushHistory, setAnnsH,
    setStrokeColorSync, setFillColorSync, setStrokeWidthSync,
    setTextSizeSync, setSelectedFontSync, setTextBoldSync, setTextItalicSync,
    undo, redo,
  } = history;

  /* keep refs in sync */
  selectedIdxRef.current = selectedIdx;
  currentPageRef.current = 1; /* updated below after doc hook */

  /* ── Document hook ── */
  const doc = usePdfDocument({
    canvasRef,
    setAnnotations, setHistory, setHistoryIdx, setSelectedIdx, setZoom, pushHistory,
  });
  const {
    file, pdfDoc, pdfBytes, pdfBytesRef,
    totalPages, currentPage, setCurrentPage,
    pageSize, renderScale, loading, pageReady,
    pdfTextItems, thumbnails, showThumbs, setShowThumbs,
    loadFile, doClearWorkspace,
  } = doc;

  /* keep currentPageRef in sync */
  currentPageRef.current = currentPage;

  /* ── Derived ── */
  const pageAnns = useMemo(() => annotations[currentPage] || [], [annotations, currentPage]);
  const totalAnns = useMemo(() => Object.values(annotations).reduce((s, a) => s + a.length, 0), [annotations]);

  /* ── Auto-save ── */
  useEffect(() => {
    if (pdfDoc) {
      localStorage.setItem('pdf_editor_annotations', JSON.stringify(annotations));
      localStorage.setItem('pdf_editor_current_page', currentPage.toString());
      localStorage.setItem('pdf_editor_zoom', zoom.toString());
    }
  }, [annotations, currentPage, zoom, pdfDoc]);

  /* ── Annotation CRUD ── */
  const addAnn = useCallback((ann) => {
    setAnnsH(prev => ({ ...prev, [currentPage]: [...(prev[currentPage] || []), { ...ann, id: uid() }] }));
  }, [currentPage, setAnnsH]);

  const updateAnn = useCallback((idx, updates) => {
    setAnnsH(prev => {
      const list = [...(prev[currentPage] || [])];
      list[idx] = { ...list[idx], ...updates };
      return { ...prev, [currentPage]: list };
    });
  }, [currentPage, setAnnsH]);

  const deleteAnn = useCallback((idx) => {
    setAnnsH(prev => ({ ...prev, [currentPage]: (prev[currentPage] || []).filter((_, i) => i !== idx) }));
    if (selectedIdx === idx) setSelectedIdx(null);
    else if (selectedIdx !== null && selectedIdx > idx) setSelectedIdx(selectedIdx - 1);
  }, [currentPage, selectedIdx, setAnnsH, setSelectedIdx]);

  const duplicateAnn = useCallback((idx) => {
    const ann = pageAnns[idx];
    if (!ann) return;
    const dup = moveAnn(cloneAnn(ann), 15, 15);
    setAnnsH(prev => ({ ...prev, [currentPage]: [...(prev[currentPage] || []), dup] }));
    setSelectedIdx(pageAnns.length);
  }, [currentPage, pageAnns, setAnnsH, setSelectedIdx]);

  const bringForward = useCallback((idx) => {
    if (idx >= pageAnns.length - 1) return;
    setAnnsH(prev => {
      const list = [...(prev[currentPage] || [])];
      [list[idx], list[idx + 1]] = [list[idx + 1], list[idx]];
      return { ...prev, [currentPage]: list };
    });
    setSelectedIdx(idx + 1);
  }, [currentPage, pageAnns.length, setAnnsH, setSelectedIdx]);

  const sendBackward = useCallback((idx) => {
    if (idx <= 0) return;
    setAnnsH(prev => {
      const list = [...(prev[currentPage] || [])];
      [list[idx], list[idx - 1]] = [list[idx - 1], list[idx]];
      return { ...prev, [currentPage]: list };
    });
    setSelectedIdx(idx - 1);
  }, [currentPage, setAnnsH, setSelectedIdx]);

  const reorderLayers = useCallback((dragIdx, targetIdx) => {
    if (dragIdx === targetIdx) return;
    setAnnsH(prev => {
      const list = [...(prev[currentPage] || [])];
      const [removed] = list.splice(dragIdx, 1);
      list.splice(targetIdx, 0, removed);
      return { ...prev, [currentPage]: list };
    });
    setSelectedIdx(targetIdx);
  }, [currentPage, setAnnsH, setSelectedIdx]);

  /* ── Text helpers ── */
  const findTextItemAt = useCallback((px, py) => {
    for (const item of pdfTextItems) {
      if (px >= item.x - 4 && px <= item.x + item.width + 4 &&
          py >= item.y - item.height - 4 && py <= item.y + 4) return item;
    }
    let bestDist = Infinity, bestItem = null;
    for (const item of pdfTextItems) {
      if (py >= item.y - item.height - 6 && py <= item.y + 6) {
        const dist = Math.abs(px - (item.x + item.width / 2));
        if (dist < bestDist) { bestDist = dist; bestItem = item; }
      }
    }
    return bestItem;
  }, [pdfTextItems]);

  const findNearestTextItem = useCallback((px, py, maxDist = 60) => {
    let best = null, bestD = maxDist;
    for (const item of pdfTextItems) {
      const cx = item.x + item.width / 2;
      const cy = item.y - item.height / 2;
      const d = Math.hypot(px - cx, py - cy);
      if (d < bestD) { bestD = d; best = item; }
    }
    return best;
  }, [pdfTextItems]);

  const computeGuides = useCallback((px, py) => {
    const hG = [], vG = [];
    const yS = new Set(), xS = new Set();
    for (const it of pdfTextItems) {
      yS.add(Math.round(it.baseline)); yS.add(Math.round(it.y - it.height));
      xS.add(Math.round(it.x)); xS.add(Math.round(it.x + it.width));
    }
    for (const ann of pageAnns) {
      const b = getBounds(ann);
      yS.add(Math.round(b.y)); yS.add(Math.round(b.y + b.h));
      xS.add(Math.round(b.x)); xS.add(Math.round(b.x + b.w));
    }
    for (const y of yS) if (Math.abs(py - y) < SNAP_THRESHOLD) hG.push(y);
    for (const x of xS) if (Math.abs(px - x) < SNAP_THRESHOLD) vG.push(x);
    return { h: hG, v: vG };
  }, [pdfTextItems, pageAnns]);

  /* ── Interaction hook ── */
  const interaction = usePdfInteraction({
    overlayRef, scrollRef, canvasRef,
    pageAnns, pageSize, currentPage,
    activeTool,
    strokeColor, setStrokeColor,
    strokeWidth, fillColor,
    textBold, textItalic, textSize, setTextSize,
    selectedFont, setSelectedFont,
    setStrokeWidth, setTextBold, setTextItalic,
    setSelectedIdx,
    pdfTextItems,
    addAnn, deleteAnn,
    pushHistory,
    setAnnotations,
    computeGuides, findTextItemAt, findNearestTextItem,
    setActiveTool,
    setConfirmModal,
    doClearWorkspace,
    FONT_OPTIONS,
    selectedIdx,
  });
  const {
    isDrawing, currentPath, shapeStart, shapePreview,
    editingText, setEditingText,
    draggingIdx,
    resizeDirection, resizeStartRef,
    isPanning, setIsPanning, spaceHeld, setSpaceHeld,
    hoveredTextItem,
    guides, setGuides,
    getPos,
    handlePointerDown, handlePointerMove, handlePointerUp,
    handleDoubleClick, handleClearWorkspace,
  } = interaction;

  /* ── handleEditorFormat (needs textInputRef from main) ── */
  const handleEditorFormat = useCallback((tag) => {
    const el = textInputRef.current;
    if (el) {
      const start = el.selectionStart;
      const end = el.selectionEnd;
      if (start !== end) {
        const text = el.value;
        const selectedText = text.substring(start, end);
        const openTag = `<${tag}>`;
        const closeTag = `</${tag}>`;
        let newSelectedText;
        if (selectedText.startsWith(openTag) && selectedText.endsWith(closeTag)) {
          newSelectedText = selectedText.substring(openTag.length, selectedText.length - closeTag.length);
        } else {
          newSelectedText = `${openTag}${selectedText}${closeTag}`;
        }
        const newValue = text.substring(0, start) + newSelectedText + text.substring(end);
        setEditingText(prev => ({ ...prev, value: newValue }));
        requestAnimationFrame(() => { if (el) { el.focus(); el.setSelectionRange(start, start + newSelectedText.length); } });
        return true;
      }
    }
    return false;
  }, [setEditingText]);

  /* ── commitText (in main — needs many deps) ── */
  const commitText = useCallback((value) => {
    if (!editingText) return;
    setGuides({ h: [], v: [] });
    const resolvedFont = selectedFont === 'auto'
      ? (editingText.matchedFont || '"Times New Roman", serif')
      : (FONT_OPTIONS.find(f => f.id === selectedFont)?.css || '"Times New Roman", serif');
    const buildWhiteout = (pi) => {
      let bgColor = '#ffffff';
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        const pts = [[10,10],[10,Math.round(pageSize.height/2)],[Math.round(pageSize.width-10),10]];
        let tR=0,tG=0,tB=0,cnt=0;
        for (const [sx,sy] of pts) {
          if (sx>=0&&sy>=0&&sx<ctx.canvas.width&&sy<ctx.canvas.height) {
            const px=ctx.getImageData(sx,sy,1,1).data;
            if(px[3]>0){tR+=px[0];tG+=px[1];tB+=px[2];cnt++;}
          }
        }
        if(cnt>0){const aR=tR/cnt,aG=tG/cnt,aB=tB/cnt;
          if(!(aR>238&&aG>238&&aB>238))
            bgColor='#'+[Math.round(aR),Math.round(aG),Math.round(aB)].map(c=>c.toString(16).padStart(2,'0')).join('');
        }
      }
      return {x:pi.x-4,y:pi.y-pi.height-4,w:pi.width+8,h:pi.height+10,bgColor};
    };
    if (editingText.editIdx != null) {
      if (value.trim()) {
        updateAnn(editingText.editIdx, {
          text: value, fontFamily: resolvedFont,
          fontSize: editingText.matchedFontSize||textSize,
          fontWeight: editingText.matchedBold?700:(editingText.matchedWeight||400),
          fontStyle: editingText.matchedItalic?'italic':'normal',
          color: editingText.matchedColor||strokeColor,
        });
      } else { deleteAnn(editingText.editIdx); }
    } else if (editingText.pdfTextItem && !value.trim()) {
      if (value !== editingText.originalValue) {
        const pi = editingText.pdfTextItem;
        addAnn({type:'text',x:editingText.x,y:editingText.y,text:'',color:'transparent',
          fontSize:editingText.matchedFontSize||textSize,fontWeight:400,fontStyle:'normal',
          fontFamily:resolvedFont,whiteout:buildWhiteout(pi)});
      }
    } else if (value.trim()) {
      if (editingText.pdfTextItem && value===editingText.originalValue){setEditingText(null);return;}
      const annData={type:'text',x:editingText.x,y:editingText.y,text:value,
        color:editingText.matchedColor||strokeColor,
        fontSize:editingText.matchedFontSize||textSize,
        fontWeight:editingText.matchedBold?700:(editingText.matchedWeight||400),
        fontStyle:editingText.matchedItalic?'italic':'normal',fontFamily:resolvedFont};
      if (editingText.pdfTextItem) annData.whiteout=buildWhiteout(editingText.pdfTextItem);
      addAnn(annData);
    }
    setEditingText(null);
  }, [editingText,updateAnn,deleteAnn,addAnn,strokeColor,textSize,selectedFont,pageSize,setGuides,canvasRef]);

  /* ── Export ── */
  const { exportPdf, processing } = usePdfExport({ pdfBytesRef, pdfBytes, file, annotations, pageSize });

  /* ── Wheel / fitToWidth ── */
  const handleWheel = useCallback((e) => {
    if (!scrollRef.current) return;
    if (e.shiftKey) { e.preventDefault(); scrollRef.current.scrollLeft += e.deltaY; return; }
    if (e.ctrlKey || e.metaKey) { e.preventDefault(); setZoom(z => clamp(z + (e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP), ZOOM_MIN, ZOOM_MAX)); }
  }, []);

  const fitToWidth = useCallback(() => {
    if (!scrollRef.current || !pageSize.width) return;
    setZoom(clamp((scrollRef.current.clientWidth - 64) / pageSize.width, ZOOM_MIN, ZOOM_MAX));
  }, [pageSize]);

  /* ── Context menu ── */
  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
    const pos = getPos(e);
    let hitIdx = null;
    for (let i = pageAnns.length - 1; i >= 0; i--) {
      if (hitTest(pageAnns[i], pos.x, pos.y)) { hitIdx = i; break; }
    }
    setContextMenu({ x: e.clientX, y: e.clientY, annIdx: hitIdx, pos });
    if (hitIdx !== null) setSelectedIdx(hitIdx);
  }, [pageAnns, getPos, setSelectedIdx]);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    window.addEventListener('contextmenu', close);
    return () => { window.removeEventListener('click', close); window.removeEventListener('contextmenu', close); };
  }, [contextMenu]);

  /* ── Keyboard shortcuts ── */
  usePdfKeyboard({
    selectedIdx, currentPage, totalPages,
    deleteAnn, duplicateAnn, undo, redo, fitToWidth, setAnnsH,
    setActiveTool, setSelectedIdx, setEditingText, setContextMenu,
    setZoom, setCurrentPage, setShowThumbs,
    setSpaceHeld, setIsPanning,
  });

  /* ── drawOverlay ── */
  const drawOverlay = useCallback(() => {
    const canvas = overlayRef.current;
    if (!canvas || !pageSize.width || !pageReady) return;
    canvas.width = pageSize.width;
    canvas.height = pageSize.height;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const drawAnn = (ann) => {
      ctx.save();
      if (ann.rotation) {
        const b = getBounds(ann);
        const cx=b.x+b.w/2, cy=b.y+b.h/2;
        ctx.translate(cx,cy); ctx.rotate(ann.rotation); ctx.translate(-cx,-cy);
      }
      ctx.strokeStyle=ann.color; ctx.fillStyle=ann.color;
      ctx.lineWidth=ann.strokeWidth||3; ctx.lineCap='round'; ctx.lineJoin='round';
      if (ann.type==='path') {
        if(ann.points.length<2){ctx.restore();return;}
        ctx.beginPath(); ctx.moveTo(ann.points[0].x,ann.points[0].y);
        for(let i=1;i<ann.points.length;i++){
          if(i<ann.points.length-1){const mx=(ann.points[i].x+ann.points[i+1].x)/2,my=(ann.points[i].y+ann.points[i+1].y)/2;ctx.quadraticCurveTo(ann.points[i].x,ann.points[i].y,mx,my);}
          else ctx.lineTo(ann.points[i].x,ann.points[i].y);
        }
        ctx.stroke();
      } else if (ann.type==='highlight') {
        if(ann.points.length<2){ctx.restore();return;}
        ctx.globalAlpha=0.35; ctx.lineWidth=ann.strokeWidth||18;
        ctx.beginPath(); ctx.moveTo(ann.points[0].x,ann.points[0].y);
        for(let i=1;i<ann.points.length;i++) ctx.lineTo(ann.points[i].x,ann.points[i].y);
        ctx.stroke(); ctx.globalAlpha=1;
      } else if (ann.type==='rect') {
        if(ann.fillColor&&ann.fillColor!=='transparent'){ctx.save();ctx.fillStyle=ann.fillColor;ctx.fillRect(ann.x,ann.y,ann.w,ann.h);ctx.restore();}
        ctx.strokeRect(ann.x,ann.y,ann.w,ann.h);
      } else if (ann.type==='circle') {
        const rx=Math.abs(ann.w)/2,ry=Math.abs(ann.h)/2;
        ctx.beginPath(); ctx.ellipse(ann.x+ann.w/2,ann.y+ann.h/2,rx||1,ry||1,0,0,Math.PI*2);
        if(ann.fillColor&&ann.fillColor!=='transparent'){ctx.save();ctx.fillStyle=ann.fillColor;ctx.fill();ctx.restore();}
        ctx.stroke();
      } else if (ann.type==='line') {
        ctx.beginPath(); ctx.moveTo(ann.x1,ann.y1); ctx.lineTo(ann.x2,ann.y2); ctx.stroke();
      } else if (ann.type==='arrow') {
        ctx.beginPath(); ctx.moveTo(ann.x1,ann.y1); ctx.lineTo(ann.x2,ann.y2); ctx.stroke();
        const angle=Math.atan2(ann.y2-ann.y1,ann.x2-ann.x1),hl=12+(ann.strokeWidth||3)*2;
        ctx.beginPath();
        ctx.moveTo(ann.x2,ann.y2); ctx.lineTo(ann.x2-hl*Math.cos(angle-0.4),ann.y2-hl*Math.sin(angle-0.4));
        ctx.moveTo(ann.x2,ann.y2); ctx.lineTo(ann.x2-hl*Math.cos(angle+0.4),ann.y2-hl*Math.sin(angle+0.4));
        ctx.stroke();
      } else if (ann.type==='text') {
        if(ann.whiteout){ctx.save();ctx.fillStyle=ann.whiteout.bgColor||'#ffffff';ctx.fillRect(ann.whiteout.x,ann.whiteout.y,ann.whiteout.w,ann.whiteout.h);ctx.restore();}
        const ff=ann.fontFamily||'"Times New Roman", serif';
        ctx.fillStyle=ann.color;
        const lines=(ann.text||'').split('\n'),lh=ann.fontSize*1.25;
        lines.forEach((line,li)=>{
          const segs=parseRichText(line); let curX=ann.x;
          segs.forEach(seg=>{
            const b2=seg.bold||(ann.fontWeight>=700),i2=seg.italic||(ann.fontStyle==='italic');
            ctx.font=`${i2?'italic ':' '}${b2?700:(ann.fontWeight||400)} ${ann.fontSize}px ${ff}`;
            ctx.fillText(seg.text,curX,ann.y+li*lh); curX+=ctx.measureText(seg.text).width;
          });
        });
      }
      ctx.restore();
    };

    pageAnns.forEach((ann,idx)=>{
      if(editingText?.editIdx===idx){
        if(ann.whiteout){ctx.save();ctx.fillStyle=ann.whiteout.bgColor||'#ffffff';ctx.fillRect(ann.whiteout.x,ann.whiteout.y,ann.whiteout.w,ann.whiteout.h);ctx.restore();}
        return;
      }
      drawAnn(ann);
      if(selectedIdx===idx){
        ctx.save();
        if(ann.rotation){const bt=getBounds(ann),cx=bt.x+bt.w/2,cy=bt.y+bt.h/2;ctx.translate(cx,cy);ctx.rotate(ann.rotation);ctx.translate(-cx,-cy);}
        const b=getBounds(ann);
        ctx.strokeStyle=getComputedStyle(document.documentElement).getPropertyValue('--cat-edit').trim()||'#6b21a8';
        ctx.lineWidth=1.5; ctx.setLineDash([4,3]);
        ctx.strokeRect(b.x-4,b.y-4,b.w+8,b.h+8); ctx.setLineDash([]);
        ctx.fillStyle=ctx.strokeStyle;
        [[b.x-4,b.y-4],[b.x+b.w,b.y-4],[b.x-4,b.y+b.h],[b.x+b.w,b.y+b.h]].forEach(([cx,cy])=>ctx.fillRect(cx-2,cy-2,8,8));
        const rx=b.x+b.w/2,ry=b.y-20;
        ctx.beginPath(); ctx.moveTo(rx,b.y-4); ctx.lineTo(rx,ry); ctx.stroke();
        ctx.beginPath(); ctx.arc(rx,ry,5,0,2*Math.PI); ctx.fill();
        ctx.restore();
      }
    });

    if(isDrawing&&currentPath.length>1){
      ctx.save(); ctx.strokeStyle=strokeColor; ctx.lineCap='round'; ctx.lineJoin='round';
      if(activeTool==='highlight'){ctx.globalAlpha=0.35;ctx.lineWidth=strokeWidth||18;}else ctx.lineWidth=strokeWidth;
      ctx.beginPath(); ctx.moveTo(currentPath[0].x,currentPath[0].y);
      for(let i=1;i<currentPath.length;i++){
        if(activeTool!=='highlight'&&i<currentPath.length-1){const mx=(currentPath[i].x+currentPath[i+1].x)/2,my=(currentPath[i].y+currentPath[i+1].y)/2;ctx.quadraticCurveTo(currentPath[i].x,currentPath[i].y,mx,my);}
        else ctx.lineTo(currentPath[i].x,currentPath[i].y);
      }
      ctx.stroke(); ctx.restore();
    }

    if(shapePreview){
      ctx.save(); ctx.strokeStyle=strokeColor; ctx.lineWidth=strokeWidth; ctx.setLineDash([5,3]);
      if(shapePreview.type==='rect'){
        if(fillColor&&fillColor!=='transparent'){ctx.save();ctx.fillStyle=fillColor;ctx.globalAlpha=0.4;ctx.fillRect(shapePreview.x,shapePreview.y,shapePreview.w,shapePreview.h);ctx.restore();}
        ctx.strokeRect(shapePreview.x,shapePreview.y,shapePreview.w,shapePreview.h);
      } else if(shapePreview.type==='circle'){
        const rx=Math.abs(shapePreview.w)/2,ry=Math.abs(shapePreview.h)/2;
        ctx.beginPath(); ctx.ellipse(shapePreview.x+shapePreview.w/2,shapePreview.y+shapePreview.h/2,rx||1,ry||1,0,0,Math.PI*2);
        if(fillColor&&fillColor!=='transparent'){ctx.save();ctx.fillStyle=fillColor;ctx.globalAlpha=0.4;ctx.fill();ctx.restore();}
        ctx.stroke();
      } else if(shapePreview.type==='line'||shapePreview.type==='arrow'){
        ctx.beginPath(); ctx.moveTo(shapePreview.x1,shapePreview.y1); ctx.lineTo(shapePreview.x2,shapePreview.y2); ctx.stroke();
        if(shapePreview.type==='arrow'){const a=Math.atan2(shapePreview.y2-shapePreview.y1,shapePreview.x2-shapePreview.x1),hl=12+strokeWidth*2;ctx.beginPath();ctx.moveTo(shapePreview.x2,shapePreview.y2);ctx.lineTo(shapePreview.x2-hl*Math.cos(a-0.4),shapePreview.y2-hl*Math.sin(a-0.4));ctx.moveTo(shapePreview.x2,shapePreview.y2);ctx.lineTo(shapePreview.x2-hl*Math.cos(a+0.4),shapePreview.y2-hl*Math.sin(a+0.4));ctx.stroke();}
      }
      ctx.restore();
    }

    if(guides.h.length>0||guides.v.length>0){
      ctx.save(); ctx.strokeStyle='#457b9d'; ctx.lineWidth=0.8; ctx.setLineDash([3,3]); ctx.globalAlpha=0.5;
      for(const y of guides.h){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(canvas.width,y);ctx.stroke();}
      for(const x of guides.v){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,canvas.height);ctx.stroke();}
      ctx.restore();
    }

    if(activeTool==='text'&&pdfTextItems.length>0){
      ctx.save();
      const hovBaseline=hoveredTextItem?.baseline,hovTol=hoveredTextItem?hoveredTextItem.fontSize*0.3:0;
      for(const item of pdfTextItems){
        const isHov=hoveredTextItem&&Math.abs(item.baseline-hovBaseline)<hovTol;
        ctx.fillStyle=isHov?'rgba(69,123,157,0.12)':'rgba(69,123,157,0.04)';
        ctx.fillRect(item.x-1,item.y-item.height-1,item.width+2,item.height+4);
        if(isHov){ctx.strokeStyle='#457b9d';ctx.lineWidth=0.8;ctx.setLineDash([2,2]);ctx.strokeRect(item.x-1,item.y-item.height-1,item.width+2,item.height+4);ctx.setLineDash([]);}
      }
      ctx.restore();
    }
  }, [pageAnns,pageSize,pageReady,isDrawing,currentPath,shapePreview,strokeColor,
      strokeWidth,selectedIdx,activeTool,editingText,guides,pdfTextItems,hoveredTextItem,fillColor]);

  useEffect(()=>{
    if(rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current=requestAnimationFrame(()=>{drawOverlay();rafRef.current=null;});
    return()=>{if(rafRef.current){cancelAnimationFrame(rafRef.current);rafRef.current=null;}};
  },[drawOverlay]);

  /* ── Cursor ── */
  const cursor = useMemo(()=>{
    if(spaceHeld||isPanning) return 'grab';
    if(activeTool==='text'&&hoveredTextItem) return 'text';
    return {select:'default',text:'text',eraser:'crosshair',draw:'crosshair',highlight:'crosshair',rect:'crosshair',circle:'crosshair',line:'crosshair',arrow:'crosshair'}[activeTool]||'crosshair';
  },[activeTool,spaceHeld,isPanning,hoveredTextItem]);

  const handleDrop = (e)=>{e.preventDefault();setDragOver(false);loadFile(e.dataTransfer.files[0]);};

  /* ── Drop zone / loading ── */
  if (!file) {
    return (
      <div className="main-content">
        <div className="workspace">
          {tool && (<div className="ws-header"><span className="ws-emoji">{tool.icon}</span><div className="ws-info"><h2>{tool.title}</h2><p>{tool.desc}</p></div></div>)}
          <div className={`dropzone${dragOver?' dragover':''}`} onClick={()=>inputRef.current?.click()} onDragOver={e=>{e.preventDefault();setDragOver(true);}} onDragLeave={()=>setDragOver(false)} onDrop={handleDrop}>
            <div className="dropzone-icon">{'✏️'}</div>
            <div className="dropzone-text"><strong>Drop a PDF here</strong> or click to browse</div>
            <input ref={inputRef} type="file" accept=".pdf" hidden onChange={e=>{loadFile(e.target.files[0]);e.target.value='';}} />
          </div>
        </div>
      </div>
    );
  }
  if (loading) {
    return (
      <div className="main-content"><div className="workspace">
        {tool&&(<div className="ws-header"><span className="ws-emoji">{tool.icon}</span><div className="ws-info"><h2>{tool.title}</h2><p>{tool.desc}</p></div></div>)}
        <div className="progress-text" style={{textAlign:'center',padding:'3rem 0'}}>Loading PDF...</div>
      </div></div>
    );
  }

  /* ── Editor render ── */
  return (
    <div style={S.wrapper}>
      <div style={S.body}>
        {/* Thumbnail strip */}
        <div style={S.thumbStrip(showThumbs)}>
          {showThumbs && Array.from({length:totalPages},(_,i)=>i+1).map(pg=>(
            <div key={pg} style={S.thumbItem(pg===currentPage)} onClick={()=>{setCurrentPage(pg);setSelectedIdx(null);}}>
              {thumbnails[pg]
                ?<img src={thumbnails[pg]} alt={`Page ${pg}`} style={{width:54,borderRadius:2,display:'block'}}/>
                :<div style={{width:54,height:70,background:'var(--bg2)',borderRadius:2,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,color:'var(--text-muted)'}}>...</div>}
              <span style={S.thumbLabel}>{pg}</span>
            </div>
          ))}
        </div>

        {/* Left toolbar */}
        <PdfEditorToolStrip
          S={S}
          activeTool={activeTool} setActiveTool={setActiveTool}
          toolStripWidth={toolStripWidth} setToolStripWidth={setToolStripWidth} toolStripResizing={toolStripResizing}
          hoveredTool={hoveredTool} setHoveredTool={setHoveredTool}
          strokeColor={strokeColor} setStrokeColorSync={setStrokeColorSync}
          fillColor={fillColor} setFillColorSync={setFillColorSync}
          strokeWidth={strokeWidth} setStrokeWidthSync={setStrokeWidthSync}
          textSize={textSize} setTextSizeSync={setTextSizeSync}
          textBold={textBold} setTextBoldSync={setTextBoldSync}
          textItalic={textItalic} setTextItalicSync={setTextItalicSync}
          selectedFont={selectedFont} setSelectedFontSync={setSelectedFontSync}
          selectedIdx={selectedIdx} setSelectedIdx={setSelectedIdx}
          editingText={editingText} setEditingText={setEditingText}
          pageAnns={pageAnns}
          isInteractingWithToolbarRef={isInteractingWithToolbarRef}
          FONT_OPTIONS={FONT_OPTIONS}
        />

        {/* Canvas area */}
        <div style={{...S.canvasArea,cursor}} onWheel={handleWheel}>
          <div ref={scrollRef} style={S.canvasScroller}>
            <div style={S.canvasContainer(zoom)}>
              <canvas ref={canvasRef} style={S.pageShadow} />
              <canvas ref={overlayRef}
                style={{position:'absolute',top:0,left:0,width:pageSize.width,height:pageSize.height,pointerEvents:editingText?'none':'auto',visibility:pageReady?'visible':'hidden'}}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onDoubleClick={handleDoubleClick}
                onContextMenu={handleContextMenu} />
              <PdfEditorTextOverlay
                editingText={editingText} setEditingText={setEditingText}
                textInputRef={textInputRef} pageSize={pageSize}
                textSize={textSize} setTextSize={setTextSize}
                strokeColor={strokeColor} setStrokeColor={setStrokeColor}
                commitText={commitText} setGuides={setGuides}
                isInteractingWithToolbarRef={isInteractingWithToolbarRef}
                handleEditorFormat={handleEditorFormat}
                FONT_OPTIONS={FONT_OPTIONS} selectedFont={selectedFont} setSelectedFont={setSelectedFont}
              />
            </div>
          </div>
        </div>

        {/* Right layers panel */}
        <div style={S.rightPanel(showLayers)}>
          <PdfEditorLayersPanel
            S={S} showLayers={showLayers}
            pageAnns={pageAnns}
            selectedIdx={selectedIdx} setSelectedIdx={setSelectedIdx}
            setActiveTool={setActiveTool}
            setStrokeColor={setStrokeColor} setStrokeWidth={setStrokeWidth}
            setTextSize={setTextSize} setTextBold={setTextBold} setTextItalic={setTextItalic} setSelectedFont={setSelectedFont}
            setStrokeColorSync={setStrokeColorSync} setFillColorSync={setFillColorSync} setStrokeWidthSync={setStrokeWidthSync}
            setTextSizeSync={setTextSizeSync} setTextBoldSync={setTextBoldSync} setTextItalicSync={setTextItalicSync} setSelectedFontSync={setSelectedFontSync}
            deleteAnn={deleteAnn} reorderLayers={reorderLayers}
            dragOverLayerIdx={dragOverLayerIdx} setDragOverLayerIdx={setDragOverLayerIdx}
            setConfirmModal={setConfirmModal} setAnnsH={setAnnsH} currentPage={currentPage}
            totalAnns={totalAnns} historyIdx={historyIdx} historyLength={histArr.length}
            FONT_OPTIONS={FONT_OPTIONS} getBounds={getBounds}
          />
        </div>
      </div>

      {/* Status bar */}
      <PdfEditorStatusBar
        S={S} file={file}
        currentPage={currentPage} totalPages={totalPages} setCurrentPage={setCurrentPage}
        zoom={zoom} setZoom={setZoom}
        showThumbs={showThumbs} setShowThumbs={setShowThumbs}
        showLayers={showLayers} setShowLayers={setShowLayers}
        totalAnns={totalAnns} processing={processing}
        handleClearWorkspace={handleClearWorkspace} exportPdf={exportPdf}
        fitToWidth={fitToWidth} setSelectedIdx={setSelectedIdx}
        clamp={clamp} ZOOM_MIN={ZOOM_MIN} ZOOM_MAX={ZOOM_MAX}
      />

      {/* Context menu */}
      <PdfEditorContextMenu
        S={S} contextMenu={contextMenu} setContextMenu={setContextMenu}
        pageAnns={pageAnns} cloneAnn={cloneAnn} moveAnn={moveAnn}
        deleteAnn={deleteAnn} duplicateAnn={duplicateAnn} bringForward={bringForward} sendBackward={sendBackward}
        clipboard={clipboard} setClipboard={setClipboard}
        setAnnsH={setAnnsH} setSelectedIdx={setSelectedIdx} currentPage={currentPage}
      />

      {/* Confirm modal */}
      <PdfEditorConfirmModal confirmModal={confirmModal} setConfirmModal={setConfirmModal} />
    </div>
  );
}
