import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import { saveAs } from 'file-saver';
import { formatSize } from '../App';

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
   Constants
   ================================================================ */
const TOOL_DEFS = [
  { id: 'select',    icon: '\u2B9C', label: 'Move',      shortcut: 'V', group: 0 },
  { id: 'text',      icon: 'T',      label: 'Text',      shortcut: 'T', group: 0 },
  { id: 'draw',      icon: '\u270E', label: 'Pen',       shortcut: 'P', group: 1 },
  { id: 'highlight', icon: '\u2588', label: 'Highlight',  shortcut: 'H', group: 1 },
  { id: 'rect',      icon: '\u25A1', label: 'Rectangle', shortcut: 'R', group: 2 },
  { id: 'circle',    icon: '\u25CB', label: 'Ellipse',   shortcut: 'E', group: 2 },
  { id: 'line',      icon: '\u2571', label: 'Line',      shortcut: 'L', group: 2 },
  { id: 'arrow',     icon: '\u2192', label: 'Arrow',     shortcut: 'A', group: 2 },
  { id: 'eraser',    icon: '\u2715', label: 'Eraser',    shortcut: 'X', group: 3 },
];

const COLORS = [
  '#1a1a1a', '#ffffff', '#e63946', '#f4a261',
  '#e9c46a', '#2a9d8f', '#457b9d', '#6a4c93',
];

const FONT_OPTIONS = [
  { id: 'auto',       label: 'Auto',            css: 'auto' },
  { id: 'serif',      label: 'Serif',           css: '"Times New Roman", "Georgia", serif' },
  { id: 'sans',       label: 'Sans-serif',      css: '"Helvetica Neue", "Arial", sans-serif' },
  { id: 'mono',       label: 'Monospace',       css: '"Courier New", "Courier", monospace' },
  { id: 'georgia',    label: 'Georgia',         css: '"Georgia", serif' },
  { id: 'garamond',   label: 'Garamond',        css: '"Garamond", "Times New Roman", serif' },
  { id: 'palatino',   label: 'Palatino',        css: '"Palatino Linotype", "Book Antiqua", serif' },
  { id: 'arial',      label: 'Arial',           css: '"Arial", "Helvetica", sans-serif' },
  { id: 'verdana',    label: 'Verdana',         css: '"Verdana", sans-serif' },
  { id: 'tahoma',     label: 'Tahoma',          css: '"Tahoma", "Geneva", sans-serif' },
];

/* Detect best CSS font-family from a PDF internal font name */
function detectFontFamily(fontName) {
  if (!fontName) return '"Times New Roman", serif';
  const fn = fontName.toLowerCase();
  if (/courier|consola|mono|fixed|monospace/i.test(fn)) {
    return '"Courier New", monospace';
  }
  if (/sans-serif|sans|arial|helv|swiss|calibri|verdana|tahoma|trebuc|segoe|roboto|lato|nunito|poppins|inter/i.test(fn)) {
    return '"Helvetica Neue", "Arial", sans-serif';
  }
  if (/serif|times|georgia|garamond|palatino|book/i.test(fn)) {
    return '"Times New Roman", "Georgia", serif';
  }
  // Default to serif for standard book/document layouts
  return '"Times New Roman", "Georgia", serif';
}

const TYPE_ICONS = {
  path: '\u270E', text: 'T', rect: '\u25A1', circle: '\u25CB',
  line: '\u2571', arrow: '\u2192', highlight: '\u2588',
};
const TYPE_LABELS = {
  path: 'Pen stroke', text: 'Text', rect: 'Rectangle', circle: 'Ellipse',
  line: 'Line', arrow: 'Arrow', highlight: 'Highlight',
};

const ZOOM_MIN = 0.25;
const ZOOM_MAX = 4.0;
const ZOOM_STEP = 0.1;
const MAX_HISTORY = 50;
const SNAP_THRESHOLD = 5;

/* ================================================================
   Styles
   ================================================================ */
const S = {
  /* Main wrapper — fills viewport below header using inset, no fixed dimensions */
  wrapper: {
    display: 'flex', flexDirection: 'column',
    position: 'fixed',
    top: 54, left: 0, right: 0, bottom: 0,
    background: 'var(--bg2)',
    zIndex: 45,
  },

  body: {
    display: 'flex', flex: 1, minHeight: 0,
  },

  /* Slim left toolbar */
  toolStrip: (w) => ({
    width: w || 44, flexShrink: 0,
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '6px 0', gap: 1,
    background: 'var(--surface)',
    borderRight: '1px solid var(--border)',
    overflowY: 'auto', overflowX: 'hidden',
    position: 'relative',
  }),
  toolBtn: (active, w) => {
    const isWide = w > 85;
    return {
      width: isWide ? `${w - 12}px` : 32,
      height: 32,
      display: 'flex',
      alignItems: 'center',
      justifyContent: isWide ? 'flex-start' : 'center',
      border: 'none',
      borderRadius: 6,
      cursor: 'pointer',
      fontSize: 13, fontWeight: 700,
      background: active ? 'var(--cat-edit-bg)' : 'transparent',
      color: active ? 'var(--cat-edit)' : 'var(--sketch-text)',
      transition: 'all 0.1s',
      padding: isWide ? '0 8px' : 0,
      position: 'relative',
      gap: isWide ? 8 : 0,
    };
  },
  toolDivider: {
    width: 22, height: 0,
    borderTop: '1px solid var(--border)',
    margin: '3px 0',
  },
  colorBtn: (c, active) => ({
    width: 16, height: 16, borderRadius: '50%',
    background: c, cursor: 'pointer', padding: 0,
    border: active ? '2px solid var(--cat-edit)' : '1.5px solid var(--border)',
    boxShadow: active ? '0 0 0 1.5px var(--surface), 0 0 0 3px var(--cat-edit)' : 'none',
    transition: 'all 0.1s',
    flexShrink: 0,
  }),

  /* Canvas area */
  canvasArea: {
    flex: 1, overflow: 'hidden', position: 'relative',
    background: 'var(--bg2)',
    backgroundImage: 'radial-gradient(var(--sketch-dot) 0.8px, transparent 0.8px)',
    backgroundSize: '16px 16px',
  },
  canvasScroller: {
    width: '100%', height: '100%',
    overflow: 'auto', position: 'relative',
    display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
    padding: 32,
  },
  canvasContainer: (zoom) => ({
    position: 'relative', display: 'inline-block', flexShrink: 0,
    transform: `scale(${zoom})`,
    transformOrigin: 'top center',
    transition: 'transform 0.06s ease-out',
  }),
  pageShadow: {
    boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 20px rgba(0,0,0,0.08)',
    borderRadius: 2,
    display: 'block',
  },

  /* Right panel */
  rightPanel: (visible) => ({
    width: visible ? 200 : 0, flexShrink: 0,
    background: 'var(--surface)',
    borderLeft: visible ? '1px solid var(--border)' : 'none',
    display: 'flex', flexDirection: 'column',
    transition: 'width 0.15s ease',
    overflow: 'hidden',
  }),
  panelSection: {
    padding: '10px 10px', borderBottom: '1px solid var(--border)',
  },
  panelTitle: {
    fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 10,
    color: 'var(--text-muted)', textTransform: 'uppercase',
    letterSpacing: '0.06em', marginBottom: 6,
  },
  layerItem: (selected) => ({
    display: 'flex', alignItems: 'center', gap: 5, padding: '4px 5px',
    borderRadius: 4, cursor: 'pointer', fontSize: 10,
    fontFamily: 'var(--font-sans)',
    background: selected ? 'var(--cat-edit-bg)' : 'transparent',
    color: selected ? 'var(--cat-edit)' : 'var(--sketch-text)',
    transition: 'all 0.08s', marginBottom: 1,
  }),
  layerIcon: {
    width: 16, height: 16,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 9, fontWeight: 700, flexShrink: 0,
  },
  layerDot: (c) => ({
    width: 7, height: 7, borderRadius: '50%',
    background: c, border: '1px solid var(--border)', flexShrink: 0,
  }),
  layerName: {
    flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    fontSize: 10,
  },
  layerDel: {
    background: 'none', border: 'none', color: 'var(--text-muted)',
    cursor: 'pointer', fontSize: 11, padding: '0 2px', lineHeight: 1,
    boxShadow: 'none', opacity: 0.5, transition: 'opacity 0.1s',
  },

  /* Thumbnails */
  thumbStrip: (visible) => ({
    width: visible ? 72 : 0, flexShrink: 0,
    borderRight: visible ? '1px solid var(--border)' : 'none',
    background: 'var(--surface)',
    overflowY: 'auto', overflowX: 'hidden',
    transition: 'width 0.15s ease',
    padding: visible ? '6px 3px' : 0,
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
  }),
  thumbItem: (active) => ({
    cursor: 'pointer', padding: 2,
    border: active ? '2px solid var(--cat-edit)' : '2px solid transparent',
    borderRadius: 3, transition: 'border-color 0.1s',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
  }),
  thumbLabel: {
    fontSize: 8, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)',
  },

  /* Status bar */
  statusBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '4px 10px', gap: 6,
    borderTop: '1px solid var(--border)',
    background: 'var(--surface)',
    flexShrink: 0, flexWrap: 'wrap',
  },
  navBtn: (disabled) => ({
    width: 26, height: 24,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    border: '1px solid var(--border)', borderRadius: 3,
    cursor: disabled ? 'default' : 'pointer',
    background: 'transparent', color: 'var(--sketch-text)',
    fontSize: 12, fontWeight: 700, padding: 0,
    opacity: disabled ? 0.3 : 0.7,
    transition: 'opacity 0.1s',
    boxShadow: 'none',
  }),
  badge: {
    fontFamily: 'var(--font-mono)', fontSize: 8,
    padding: '1px 4px', borderRadius: 2,
    background: 'var(--bg2)', color: 'var(--text-muted)',
    fontWeight: 600, lineHeight: '1.4',
  },

  /* Context menu */
  ctxMenu: (x, y) => ({
    position: 'fixed', left: x, top: y, zIndex: 9999,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
    padding: '3px 0', minWidth: 150,
    fontFamily: 'var(--font-sans)', fontSize: 11,
  }),
  ctxItem: (danger) => ({
    padding: '5px 12px', cursor: 'pointer',
    color: danger ? '#e63946' : 'var(--sketch-text)',
    background: 'transparent', border: 'none',
    display: 'block', width: '100%', textAlign: 'left',
    fontSize: 11, fontFamily: 'var(--font-sans)',
    transition: 'background 0.08s',
  }),
  ctxDivider: {
    height: 1, background: 'var(--border)', margin: '2px 0',
  },

  /* Tooltip */
  tooltip: {
    position: 'absolute', left: '100%', top: '50%', transform: 'translateY(-50%)',
    marginLeft: 8, padding: '3px 8px',
    background: 'var(--sketch-text)', color: 'var(--sketch-bg)',
    fontSize: 10, fontFamily: 'var(--font-sans)', fontWeight: 600,
    borderRadius: 4, whiteSpace: 'nowrap', pointerEvents: 'none',
    zIndex: 100, opacity: 0, transition: 'opacity 0.12s',
  },

  /* Editor header bar */
  editorHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 12px', height: 44, flexShrink: 0,
    background: 'var(--surface)',
    borderBottom: '1px solid var(--border)',
  },
  editorHeaderLeft: {
    display: 'flex', alignItems: 'center', gap: 8,
  },
  editorBackBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 13, fontWeight: 600, color: 'var(--sketch-text)',
    fontFamily: 'var(--font-sans)', padding: '4px 8px',
    borderRadius: 4, transition: 'background 0.1s',
    display: 'flex', alignItems: 'center', gap: 4,
  },
  editorTitle: {
    fontSize: 14, fontWeight: 700, color: 'var(--sketch-text)',
    fontFamily: 'var(--font-hand)',
  },
  editorHeaderRight: {
    display: 'flex', alignItems: 'center', gap: 6,
  },
};

/* ================================================================
   Helpers
   ================================================================ */
function hexToRgb(hex) {
  if (!hex || hex === 'transparent') return rgb(0, 0, 0);
  // Handle rgb(...) format
  const rgbMatch = hex.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (rgbMatch) {
    return rgb(+rgbMatch[1] / 255, +rgbMatch[2] / 255, +rgbMatch[3] / 255);
  }
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return rgb(0, 0, 0);
  return rgb(r / 255, g / 255, b / 255);
}

function clamp(val, min, max) {
  return Math.min(max, Math.max(min, val));
}

function uid() {
  return Date.now() + Math.random();
}

function getBounds(ann) {
  if (ann.type === 'path' || ann.type === 'highlight') {
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    for (const p of (ann.points || [])) {
      if (p.x < x1) x1 = p.x;
      if (p.y < y1) y1 = p.y;
      if (p.x > x2) x2 = p.x;
      if (p.y > y2) y2 = p.y;
    }
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  }
  if (ann.type === 'rect' || ann.type === 'circle') {
    const x = ann.w >= 0 ? ann.x : ann.x + ann.w;
    const y = ann.h >= 0 ? ann.y : ann.y + ann.h;
    return { x, y, w: Math.abs(ann.w), h: Math.abs(ann.h) };
  }
  if (ann.type === 'line' || ann.type === 'arrow') {
    return {
      x: Math.min(ann.x1, ann.x2), y: Math.min(ann.y1, ann.y2),
      w: Math.abs(ann.x2 - ann.x1) || 8, h: Math.abs(ann.y2 - ann.y1) || 8,
    };
  }
  if (ann.type === 'text') {
    const lines = (ann.text || '').split('\n');
    const maxLen = Math.max(...lines.map(l => l.length), 1);
    const w = maxLen * ann.fontSize * 0.55;
    const lineH = ann.fontSize * 1.25;
    const h = lines.length * lineH;
    return { x: ann.x, y: ann.y - ann.fontSize, w: Math.max(w, 20), h: Math.max(h, ann.fontSize * 1.3) };
  }
  return { x: 0, y: 0, w: 0, h: 0 };
}

function getHandleAt(ann, px, py) {
  const b = getBounds(ann);
  const pad = 6;
  
  let tx = px;
  let ty = py;
  if (ann.rotation) {
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    const dx = px - cx;
    const dy = py - cy;
    const cos = Math.cos(-ann.rotation);
    const sin = Math.sin(-ann.rotation);
    tx = cx + dx * cos - dy * sin;
    ty = cy + dx * sin + dy * cos;
  }

  const handles = {
    nw: { x: b.x - 4, y: b.y - 4 },
    ne: { x: b.x + b.w, y: b.y - 4 },
    sw: { x: b.x - 4, y: b.y + b.h },
    se: { x: b.x + b.w, y: b.y + b.h },
    rotate: { x: b.x + b.w / 2, y: b.y - 20 }
  };
  for (const [dir, pt] of Object.entries(handles)) {
    if (Math.abs(tx - pt.x) <= pad + 3 && Math.abs(ty - pt.y) <= pad + 3) {
      return dir;
    }
  }
  return null;
}

function hitTest(ann, px, py) {
  const b = getBounds(ann);
  const pad = 6;
  let tx = px;
  let ty = py;
  if (ann.rotation) {
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    const dx = px - cx;
    const dy = py - cy;
    const cos = Math.cos(-ann.rotation);
    const sin = Math.sin(-ann.rotation);
    tx = cx + dx * cos - dy * sin;
    ty = cy + dx * sin + dy * cos;
  }
  return tx >= b.x - pad && tx <= b.x + b.w + pad &&
         ty >= b.y - pad && ty <= b.y + b.h + pad;
}

function moveAnn(ann, dx, dy) {
  const m = { ...ann };
  if (m.type === 'path' || m.type === 'highlight') {
    m.points = m.points.map(p => ({ x: p.x + dx, y: p.y + dy }));
  } else if (m.type === 'rect' || m.type === 'circle') {
    m.x += dx; m.y += dy;
  } else if (m.type === 'line' || m.type === 'arrow') {
    m.x1 += dx; m.y1 += dy; m.x2 += dx; m.y2 += dy;
  } else if (m.type === 'text') {
    m.x += dx; m.y += dy;
    if (m.whiteout) {
      m.whiteout = { ...m.whiteout, x: m.whiteout.x + dx, y: m.whiteout.y + dy };
    }
  }
  return m;
}

function cloneAnn(ann) {
  const c = { ...ann, id: uid() };
  if (c.points) c.points = c.points.map(p => ({ ...p }));
  if (c.whiteout) c.whiteout = { ...c.whiteout };
  return c;
}

/* ================================================================
   Component
   ================================================================ */
export default function PdfEditor({ onBack, tool }) {
  /* File & PDF state */
  const [file, setFile] = useState(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pdfBytes, setPdfBytes] = useState(null);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });
  const [renderScale] = useState(1.5);
  const [zoom, setZoom] = useState(1.0);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  /* Tool state */
  const [activeTool, setActiveTool] = useState('select');
  const [strokeColor, setStrokeColor] = useState('#1a1a1a');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [textSize, setTextSize] = useState(18);
  const [selectedFont, setSelectedFont] = useState('auto');
  const [textBold, setTextBold] = useState(false);
  const [textItalic, setTextItalic] = useState(false);

  /* Annotations keyed by page */
  const [annotations, setAnnotations] = useState({});
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState([]);
  const [shapeStart, setShapeStart] = useState(null);
  const [shapePreview, setShapePreview] = useState(null);
  const [editingText, setEditingText] = useState(null);
  const [selectedIdx, setSelectedIdx] = useState(null);
  const [draggingIdx, setDraggingIdx] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizeDirection, setResizeDirection] = useState(null);
  const resizeStartRef = useRef(null);

  /* Undo/redo */
  const [history, setHistory] = useState([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const skipHistoryRef = useRef(false);

  /* Pan state */
  const [isPanning, setIsPanning] = useState(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const panStartRef = useRef(null);
  const panScrollRef = useRef(null);

  /* UI toggles */
  const [showThumbs, setShowThumbs] = useState(false);
  const [showLayers, setShowLayers] = useState(true);
  const [thumbnails, setThumbnails] = useState({});
  const [hoveredTool, setHoveredTool] = useState(null);
  const [toolStripWidth, setToolStripWidth] = useState(44);
  const toolStripResizing = useRef(false);

  /* Context menu */
  const [contextMenu, setContextMenu] = useState(null);
  const [clipboard, setClipboard] = useState(null);

  /* PDF text extraction for editing + alignment */
  const [pdfTextItems, setPdfTextItems] = useState([]);
  const [guides, setGuides] = useState({ h: [], v: [] });
  const [hoveredTextItem, setHoveredTextItem] = useState(null);

  /* Refs */
  const inputRef = useRef();
  const canvasRef = useRef();
  const overlayRef = useRef();
  const scrollRef = useRef();
  const textInputRef = useRef();
  const pdfBytesRef = useRef(null);
  const isInteractingWithToolbarRef = useRef(false);

  const pageAnns = annotations[currentPage] || [];
  const totalAnns = Object.values(annotations).reduce((s, a) => s + a.length, 0);

  /* ================================================================
     History management
     ================================================================ */
  const pushHistory = useCallback((anns) => {
    setHistory(prev => {
      const truncated = prev.slice(0, historyIdx + 1);
      const next = [...truncated, JSON.parse(JSON.stringify(anns))];
      if (next.length > MAX_HISTORY) next.shift();
      return next;
    });
    setHistoryIdx(prev => Math.min(prev + 1, MAX_HISTORY - 1));
  }, [historyIdx]);

  const setAnnsH = useCallback((updater) => {
    setAnnotations(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      setTimeout(() => {
        if (!skipHistoryRef.current) pushHistory(next);
        skipHistoryRef.current = false;
      }, 0);
      return next;
    });
  }, [pushHistory]);

  const setStrokeColorSync = (val) => {
    setStrokeColor(val);
    if (selectedIdx !== null) {
      setAnnsH(prev => {
        const list = [...(prev[currentPage] || [])];
        if (list[selectedIdx]) {
          list[selectedIdx] = { ...list[selectedIdx], color: val };
        }
        return { ...prev, [currentPage]: list };
      });
    }
  };

  const setStrokeWidthSync = (val) => {
    setStrokeWidth(val);
    if (selectedIdx !== null) {
      setAnnsH(prev => {
        const list = [...(prev[currentPage] || [])];
        if (list[selectedIdx]) {
          list[selectedIdx] = { ...list[selectedIdx], strokeWidth: val };
        }
        return { ...prev, [currentPage]: list };
      });
    }
  };

  const setTextSizeSync = (val) => {
    setTextSize(val);
    if (selectedIdx !== null) {
      setAnnsH(prev => {
        const list = [...(prev[currentPage] || [])];
        if (list[selectedIdx] && list[selectedIdx].type === 'text') {
          list[selectedIdx] = { ...list[selectedIdx], fontSize: val };
        }
        return { ...prev, [currentPage]: list };
      });
    }
  };

  const setSelectedFontSync = (val) => {
    setSelectedFont(val);
    if (selectedIdx !== null) {
      setAnnsH(prev => {
        const list = [...(prev[currentPage] || [])];
        if (list[selectedIdx] && list[selectedIdx].type === 'text') {
          const resolved = val === 'auto'
            ? (list[selectedIdx].detectedFont || '"Times New Roman", serif')
            : (FONT_OPTIONS.find(f => f.id === val)?.css || '"Times New Roman", serif');
          list[selectedIdx] = { ...list[selectedIdx], fontFamily: resolved };
        }
        return { ...prev, [currentPage]: list };
      });
    }
  };

  const setTextBoldSync = (val) => {
    setTextBold(val);
    if (selectedIdx !== null) {
      setAnnsH(prev => {
        const list = [...(prev[currentPage] || [])];
        if (list[selectedIdx] && list[selectedIdx].type === 'text') {
          list[selectedIdx] = { ...list[selectedIdx], fontWeight: val ? 700 : 400 };
        }
        return { ...prev, [currentPage]: list };
      });
    }
  };

  const setTextItalicSync = (val) => {
    setTextItalic(val);
    if (selectedIdx !== null) {
      setAnnsH(prev => {
        const list = [...(prev[currentPage] || [])];
        if (list[selectedIdx] && list[selectedIdx].type === 'text') {
          list[selectedIdx] = { ...list[selectedIdx], fontStyle: val ? 'italic' : 'normal' };
        }
        return { ...prev, [currentPage]: list };
      });
    }
  };

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

  /* ================================================================
     File loading
     ================================================================ */
  const loadFile = async (f) => {
    if (!f || f.type !== 'application/pdf') return;
    setFile(f);
    setLoading(true);
    setAnnotations({});
    setCurrentPage(1);
    setSelectedIdx(null);
    setHistory([]);
    setHistoryIdx(-1);
    setThumbnails({});
    try {
      const pdfjsLib = await getPdfjsLib();
      const bytes = await f.arrayBuffer();
      const u8 = new Uint8Array(bytes);
      pdfBytesRef.current = u8;
      setPdfBytes(u8);
      
      const clonedU8 = new Uint8Array(bytes.slice(0));
      const doc = await pdfjsLib.getDocument({ data: clonedU8 }).promise;
      setPdfDoc(doc);
      setTotalPages(doc.numPages);
      pushHistory({});
    } catch (err) {
      alert('Error loading PDF: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    loadFile(e.dataTransfer.files[0]);
  };

  /* ================================================================
     Render PDF page
     ================================================================ */
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;
    let cancelled = false;
    (async () => {
      const page = await pdfDoc.getPage(currentPage);
      const vp = page.getViewport({ scale: renderScale });
      const canvas = canvasRef.current;
      canvas.width = vp.width;
      canvas.height = vp.height;
      setPageSize({ width: vp.width, height: vp.height });
      const ctx = canvas.getContext('2d');
      if (!cancelled) await page.render({ canvasContext: ctx, viewport: vp }).promise;
    })();
    return () => { cancelled = true; };
  }, [pdfDoc, currentPage, renderScale]);

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
        // tc.styles maps fontName -> { fontFamily, ascent, descent, vertical }
        const styles = tc.styles || {};
        const items = tc.items
          .filter(it => it.str && it.str.trim())
          .map(it => {
            const tx = it.transform;
            const fontSize = Math.round(Math.abs(tx[3]) * renderScale);
            const x = tx[4] * renderScale;
            const y = vp.height - tx[5] * renderScale;
            const width = it.width * renderScale;
            const height = it.height * renderScale;
            const fn = it.fontName || '';
            // Use PDF.js styles for actual font family when available
            const styleInfo = styles[fn];
            const actualFamily = styleInfo?.fontFamily || '';
            const detFont = actualFamily
              ? detectFontFamily(actualFamily)
              : detectFontFamily(fn);
            const isBoldFromName = /bold/i.test(fn) || /bold/i.test(actualFamily);
            const isItalicFromName = /italic|oblique/i.test(fn) || /italic|oblique/i.test(actualFamily);
            return {
              str: it.str, x, y, width, height, fontSize,
              fontName: fn,
              actualFamily,
              detectedFont: detFont,
              isBold: isBoldFromName,
              isItalic: isItalicFromName,
              baseline: y,
            };
          });
        if (!cancelled) setPdfTextItems(items);
      } catch { if (!cancelled) setPdfTextItems([]); }
    })();
    return () => { cancelled = true; };
  }, [pdfDoc, currentPage, renderScale]);

  /* Find PDF text item at click position — merges all chunks on the same line */
  const findTextItemAt = useCallback((px, py) => {
    // First try exact hit on a chunk
    let hitItem = null;
    for (const item of pdfTextItems) {
      if (px >= item.x - 4 && px <= item.x + item.width + 4 &&
          py >= item.y - item.height - 4 && py <= item.y + 4) {
        hitItem = item;
        break;
      }
    }

    // If no exact hit, find nearest chunk whose vertical range contains click y
    if (!hitItem) {
      let bestDist = Infinity;
      for (const item of pdfTextItems) {
        const yTop = item.y - item.height - 4;
        const yBot = item.y + 4;
        if (py >= yTop && py <= yBot) {
          const cx = item.x + item.width / 2;
          const dist = Math.abs(px - cx);
          if (dist < bestDist && dist < item.width * 3) {
            bestDist = dist;
            hitItem = item;
          }
        }
      }
    }
    if (!hitItem) return null;

    // Gather all chunks on same baseline (within tolerance)
    const tolerance = hitItem.fontSize * 0.5;
    const lineItems = pdfTextItems.filter(it =>
      Math.abs(it.baseline - hitItem.baseline) < tolerance
    );
    lineItems.sort((a, b) => a.x - b.x);

    // Merge with proper spacing — add space between chunks that have gaps
    let mergedStr = '';
    for (let i = 0; i < lineItems.length; i++) {
      if (i > 0) {
        const prev = lineItems[i - 1];
        const gap = lineItems[i].x - (prev.x + prev.width);
        // Add space if there's a gap between chunks (> 1px)
        if (gap > 1) mergedStr += ' ';
      }
      mergedStr += lineItems[i].str;
    }

    const minX = Math.min(...lineItems.map(it => it.x));
    const maxRight = Math.max(...lineItems.map(it => it.x + it.width));
    const maxHeight = Math.max(...lineItems.map(it => it.height));
    return {
      str: mergedStr,
      x: minX,
      y: hitItem.y,
      width: maxRight - minX,
      height: maxHeight,
      fontSize: hitItem.fontSize,
      fontName: hitItem.fontName,
      detectedFont: hitItem.detectedFont,
      isBold: hitItem.isBold,
      isItalic: hitItem.isItalic,
      baseline: hitItem.baseline,
    };
  }, [pdfTextItems]);

  /* Find nearest text item for font matching */
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

  /* Compute snap guides */
  const computeGuides = useCallback((px, py) => {
    const hG = [], vG = [];
    const yS = new Set(), xS = new Set();
    for (const it of pdfTextItems) {
      yS.add(Math.round(it.baseline));
      yS.add(Math.round(it.y - it.height));
      xS.add(Math.round(it.x));
      xS.add(Math.round(it.x + it.width));
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
     Annotation CRUD
     ================================================================ */
  const addAnn = useCallback((ann) => {
    setAnnsH(prev => ({
      ...prev,
      [currentPage]: [...(prev[currentPage] || []), { ...ann, id: uid() }],
    }));
  }, [currentPage, setAnnsH]);

  const updateAnn = useCallback((idx, updates) => {
    setAnnsH(prev => {
      const list = [...(prev[currentPage] || [])];
      list[idx] = { ...list[idx], ...updates };
      return { ...prev, [currentPage]: list };
    });
  }, [currentPage, setAnnsH]);

  const deleteAnn = useCallback((idx) => {
    setAnnsH(prev => ({
      ...prev,
      [currentPage]: (prev[currentPage] || []).filter((_, i) => i !== idx),
    }));
    if (selectedIdx === idx) setSelectedIdx(null);
    else if (selectedIdx !== null && selectedIdx > idx) setSelectedIdx(selectedIdx - 1);
  }, [currentPage, selectedIdx, setAnnsH]);

  const duplicateAnn = useCallback((idx) => {
    const ann = pageAnns[idx];
    if (!ann) return;
    const dup = moveAnn(cloneAnn(ann), 15, 15);
    setAnnsH(prev => ({
      ...prev,
      [currentPage]: [...(prev[currentPage] || []), dup],
    }));
    setSelectedIdx(pageAnns.length);
  }, [currentPage, pageAnns, setAnnsH]);

  const bringForward = useCallback((idx) => {
    if (idx >= pageAnns.length - 1) return;
    setAnnsH(prev => {
      const list = [...(prev[currentPage] || [])];
      [list[idx], list[idx + 1]] = [list[idx + 1], list[idx]];
      return { ...prev, [currentPage]: list };
    });
    setSelectedIdx(idx + 1);
  }, [currentPage, pageAnns.length, setAnnsH]);

  const sendBackward = useCallback((idx) => {
    if (idx <= 0) return;
    setAnnsH(prev => {
      const list = [...(prev[currentPage] || [])];
      [list[idx], list[idx - 1]] = [list[idx - 1], list[idx]];
      return { ...prev, [currentPage]: list };
    });
    setSelectedIdx(idx - 1);
  }, [currentPage, setAnnsH]);

  /* ================================================================
     Overlay drawing
     ================================================================ */
  const drawOverlay = useCallback(() => {
    const canvas = overlayRef.current;
    if (!canvas || !pageSize.width) return;
    canvas.width = pageSize.width;
    canvas.height = pageSize.height;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const drawAnn = (ann) => {
      ctx.save();
      if (ann.rotation) {
        const b = getBounds(ann);
        const cx = b.x + b.w / 2;
        const cy = b.y + b.h / 2;
        ctx.translate(cx, cy);
        ctx.rotate(ann.rotation);
        ctx.translate(-cx, -cy);
      }
      ctx.strokeStyle = ann.color;
      ctx.fillStyle = ann.color;
      ctx.lineWidth = ann.strokeWidth || 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (ann.type === 'path') {
        if (ann.points.length < 2) { ctx.restore(); return; }
        ctx.beginPath();
        ctx.moveTo(ann.points[0].x, ann.points[0].y);
        for (let i = 1; i < ann.points.length; i++) {
          // Smooth using midpoints for nicer curves
          if (i < ann.points.length - 1) {
            const mx = (ann.points[i].x + ann.points[i + 1].x) / 2;
            const my = (ann.points[i].y + ann.points[i + 1].y) / 2;
            ctx.quadraticCurveTo(ann.points[i].x, ann.points[i].y, mx, my);
          } else {
            ctx.lineTo(ann.points[i].x, ann.points[i].y);
          }
        }
        ctx.stroke();
      } else if (ann.type === 'highlight') {
        if (ann.points.length < 2) { ctx.restore(); return; }
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = ann.strokeWidth || 18;
        ctx.beginPath();
        ctx.moveTo(ann.points[0].x, ann.points[0].y);
        for (let i = 1; i < ann.points.length; i++) ctx.lineTo(ann.points[i].x, ann.points[i].y);
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (ann.type === 'rect') {
        ctx.strokeRect(ann.x, ann.y, ann.w, ann.h);
      } else if (ann.type === 'circle') {
        const rx = Math.abs(ann.w) / 2, ry = Math.abs(ann.h) / 2;
        ctx.beginPath();
        ctx.ellipse(ann.x + ann.w / 2, ann.y + ann.h / 2, rx || 1, ry || 1, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (ann.type === 'line') {
        ctx.beginPath();
        ctx.moveTo(ann.x1, ann.y1); ctx.lineTo(ann.x2, ann.y2);
        ctx.stroke();
      } else if (ann.type === 'arrow') {
        ctx.beginPath();
        ctx.moveTo(ann.x1, ann.y1); ctx.lineTo(ann.x2, ann.y2);
        ctx.stroke();
        const angle = Math.atan2(ann.y2 - ann.y1, ann.x2 - ann.x1);
        const hl = 12 + (ann.strokeWidth || 3) * 2;
        ctx.beginPath();
        ctx.moveTo(ann.x2, ann.y2);
        ctx.lineTo(ann.x2 - hl * Math.cos(angle - 0.4), ann.y2 - hl * Math.sin(angle - 0.4));
        ctx.moveTo(ann.x2, ann.y2);
        ctx.lineTo(ann.x2 - hl * Math.cos(angle + 0.4), ann.y2 - hl * Math.sin(angle + 0.4));
        ctx.stroke();
      } else if (ann.type === 'text') {
        // Draw whiteout rectangle first if present
        if (ann.whiteout) {
          ctx.save();
          ctx.fillStyle = ann.whiteout.bgColor || '#ffffff';
          ctx.fillRect(ann.whiteout.x, ann.whiteout.y, ann.whiteout.w, ann.whiteout.h);
          ctx.restore();
        }
        const wt = ann.fontWeight || 400;
        const st = ann.fontStyle === 'italic' ? 'italic ' : '';
        const ff = ann.fontFamily || '"Times New Roman", serif';
        ctx.font = `${st}${wt} ${ann.fontSize}px ${ff}`;
        ctx.fillStyle = ann.color;
        const lines = (ann.text || '').split('\n');
        const lh = ann.fontSize * 1.25;
        lines.forEach((line, li) => {
          ctx.fillText(line, ann.x, ann.y + li * lh);
        });
      }
      ctx.restore();
    };

    // Draw all annotations
    pageAnns.forEach((ann, idx) => {
      if (editingText?.editIdx === idx) {
        // Still draw whiteout to hide original PDF text while editing
        if (ann.whiteout) {
          ctx.save();
          ctx.fillStyle = ann.whiteout.bgColor || '#ffffff';
          ctx.fillRect(ann.whiteout.x, ann.whiteout.y, ann.whiteout.w, ann.whiteout.h);
          ctx.restore();
        }
        return;
      }
      drawAnn(ann);

      // Selection outline
      if (selectedIdx === idx) {
        ctx.save();
        if (ann.rotation) {
          const b_temp = getBounds(ann);
          const cx = b_temp.x + b_temp.w / 2;
          const cy = b_temp.y + b_temp.h / 2;
          ctx.translate(cx, cy);
          ctx.rotate(ann.rotation);
          ctx.translate(-cx, -cy);
        }
        const b = getBounds(ann);
        ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--cat-edit').trim() || '#6b21a8';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(b.x - 4, b.y - 4, b.w + 8, b.h + 8);
        ctx.setLineDash([]);
        ctx.fillStyle = ctx.strokeStyle;
        const corners = [
          [b.x - 4, b.y - 4], [b.x + b.w, b.y - 4],
          [b.x - 4, b.y + b.h], [b.x + b.w, b.y + b.h],
        ];
        for (const [cx, cy] of corners) {
          ctx.fillRect(cx - 2, cy - 2, 8, 8);
        }

        // Rotation handle
        const rx = b.x + b.w / 2;
        const ry = b.y - 20;
        ctx.beginPath();
        ctx.moveTo(rx, b.y - 4);
        ctx.lineTo(rx, ry);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(rx, ry, 5, 0, 2 * Math.PI);
        ctx.fill();

        ctx.restore();
      }
    });

    // Live freehand preview
    if (isDrawing && currentPath.length > 1) {
      ctx.save();
      ctx.strokeStyle = strokeColor;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (activeTool === 'highlight') {
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = strokeWidth || 18;
      } else {
        ctx.lineWidth = strokeWidth;
      }
      ctx.beginPath();
      ctx.moveTo(currentPath[0].x, currentPath[0].y);
      for (let i = 1; i < currentPath.length; i++) {
        if (activeTool !== 'highlight' && i < currentPath.length - 1) {
          const mx = (currentPath[i].x + currentPath[i + 1].x) / 2;
          const my = (currentPath[i].y + currentPath[i + 1].y) / 2;
          ctx.quadraticCurveTo(currentPath[i].x, currentPath[i].y, mx, my);
        } else {
          ctx.lineTo(currentPath[i].x, currentPath[i].y);
        }
      }
      ctx.stroke();
      ctx.restore();
    }

    // Shape preview
    if (shapePreview) {
      ctx.save();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.setLineDash([5, 3]);
      if (shapePreview.type === 'rect') {
        ctx.strokeRect(shapePreview.x, shapePreview.y, shapePreview.w, shapePreview.h);
      } else if (shapePreview.type === 'circle') {
        const rx = Math.abs(shapePreview.w) / 2, ry = Math.abs(shapePreview.h) / 2;
        ctx.beginPath();
        ctx.ellipse(shapePreview.x + shapePreview.w / 2, shapePreview.y + shapePreview.h / 2, rx || 1, ry || 1, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (shapePreview.type === 'line' || shapePreview.type === 'arrow') {
        ctx.beginPath();
        ctx.moveTo(shapePreview.x1, shapePreview.y1);
        ctx.lineTo(shapePreview.x2, shapePreview.y2);
        ctx.stroke();
        if (shapePreview.type === 'arrow') {
          const a = Math.atan2(shapePreview.y2 - shapePreview.y1, shapePreview.x2 - shapePreview.x1);
          const hl = 12 + strokeWidth * 2;
          ctx.beginPath();
          ctx.moveTo(shapePreview.x2, shapePreview.y2);
          ctx.lineTo(shapePreview.x2 - hl * Math.cos(a - 0.4), shapePreview.y2 - hl * Math.sin(a - 0.4));
          ctx.moveTo(shapePreview.x2, shapePreview.y2);
          ctx.lineTo(shapePreview.x2 - hl * Math.cos(a + 0.4), shapePreview.y2 - hl * Math.sin(a + 0.4));
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // Alignment guides
    if (guides.h.length > 0 || guides.v.length > 0) {
      ctx.save();
      ctx.strokeStyle = '#457b9d';
      ctx.lineWidth = 0.8;
      ctx.setLineDash([3, 3]);
      ctx.globalAlpha = 0.5;
      for (const y of guides.h) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
      }
      for (const x of guides.v) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
      }
      ctx.restore();
    }

    // Text tool: hover highlight on PDF text regions (highlight entire line when hovered)
    if (activeTool === 'text' && pdfTextItems.length > 0) {
      ctx.save();
      const hovBaseline = hoveredTextItem?.baseline;
      const hovTolerance = hoveredTextItem ? hoveredTextItem.fontSize * 0.3 : 0;
      for (const item of pdfTextItems) {
        const isHovered = hoveredTextItem && Math.abs(item.baseline - hovBaseline) < hovTolerance;
        ctx.fillStyle = isHovered ? 'rgba(69, 123, 157, 0.12)' : 'rgba(69, 123, 157, 0.04)';
        ctx.fillRect(item.x - 1, item.y - item.height - 1, item.width + 2, item.height + 4);
        if (isHovered) {
          ctx.strokeStyle = '#457b9d';
          ctx.lineWidth = 0.8;
          ctx.setLineDash([2, 2]);
          ctx.strokeRect(item.x - 1, item.y - item.height - 1, item.width + 2, item.height + 4);
          ctx.setLineDash([]);
        }
      }
      ctx.restore();
    }
  }, [pageAnns, pageSize, isDrawing, currentPath, shapePreview, strokeColor,
      strokeWidth, selectedIdx, activeTool, editingText, guides, pdfTextItems,
      hoveredTextItem]);

  useEffect(() => { drawOverlay(); }, [drawOverlay]);

  /* ================================================================
     Canvas coordinate helpers
     ================================================================ */
  const getPos = useCallback((e) => {
    const ol = overlayRef.current;
    if (!ol) return { x: 0, y: 0 };
    const r = ol.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (pageSize.width / r.width),
      y: (e.clientY - r.top) * (pageSize.height / r.height),
    };
  }, [pageSize]);

  /* ================================================================
     Pointer handlers
     ================================================================ */
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
      // First check if clicking on a handle of the currently selected annotation
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

          // Synchronize sidebar properties
          if (ann.color) setStrokeColor(ann.color);
          if (ann.strokeWidth) setStrokeWidth(ann.strokeWidth);
          if (ann.type === 'text') {
            if (ann.fontSize) setTextSize(ann.fontSize);
            setTextBold(ann.fontWeight >= 700);
            setTextItalic(ann.fontStyle === 'italic');
            const matchFontOption = FONT_OPTIONS.find(f => f.css === ann.fontFamily);
            if (matchFontOption) setSelectedFont(matchFontOption.id);
            else setSelectedFont('auto');
          }
          return;
        }
      }
      setSelectedIdx(null);
      return;
    }

    if (activeTool === 'text') {
      // First check if clicking on existing annotation text
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
            clickX: pos.x,
          });
          setSelectedIdx(null);
          setTimeout(() => textInputRef.current?.focus(), 30);
          return;
        }
      }

      // Check if clicking on PDF text -> edit with whiteout
      const hit = findTextItemAt(pos.x, pos.y);
      if (hit) {
        // Sample text color from rendered canvas — try multiple points to find actual text pixels
        let sampledColor = '#1a1a1a';
        if (canvasRef.current) {
          const ctx = canvasRef.current.getContext('2d');
          const cy = Math.round(hit.y - hit.height * 0.35);
          // Sample several x positions along the text to hit actual character pixels
          const sampleXs = [0.1, 0.2, 0.3, 0.5, 0.7].map(f => Math.round(hit.x + hit.width * f));
          let bestPixel = null, bestDarkness = 255 * 3;
          for (const sx of sampleXs) {
            const pixel = ctx.getImageData(sx, cy, 1, 1).data;
            const brightness = pixel[0] + pixel[1] + pixel[2];
            // Skip near-white pixels (background)
            if (brightness > 700) continue;
            if (brightness < bestDarkness) {
              bestDarkness = brightness;
              bestPixel = pixel;
            }
          }
          if (bestPixel) {
            sampledColor = `rgb(${bestPixel[0]}, ${bestPixel[1]}, ${bestPixel[2]})`;
          }
        }
        setTextSize(hit.fontSize);
        setStrokeColor(sampledColor);
        setEditingText({
          x: hit.x, y: hit.baseline,
          value: hit.str,
          originalValue: hit.str,
          matchedFontSize: hit.fontSize,
          matchedBold: hit.isBold,
          matchedItalic: hit.isItalic,
          matchedColor: sampledColor,
          matchedFont: hit.detectedFont,
          pdfTextItem: hit,
          clickX: pos.x,
        });
        setSelectedIdx(null);
        setGuides({ h: [hit.baseline], v: [hit.x] });
        setTimeout(() => textInputRef.current?.focus(), 30);
        return;
      }

      // New text on empty area
      const nearby = findNearestTextItem(pos.x, pos.y, 60);
      if (nearby) setTextSize(nearby.fontSize);

      const g = computeGuides(pos.x, pos.y);
      const sx = g.v.length > 0 ? g.v[0] : pos.x;
      const sy = g.h.length > 0 ? g.h[0] : pos.y;
      setGuides(g);
      setEditingText({
        x: sx, y: sy, value: '',
        matchedBold: textBold,
        matchedItalic: textItalic,
      });
      setSelectedIdx(null);
      setTimeout(() => textInputRef.current?.focus(), 30);
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
  }, [activeTool, pageAnns, getPos, deleteAnn, spaceHeld, findTextItemAt, findNearestTextItem, computeGuides]);

  const handlePointerMove = useCallback((e) => {
    // Panning
    if (isPanning && panStartRef.current && scrollRef.current) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      scrollRef.current.scrollLeft = panScrollRef.current.x - dx;
      scrollRef.current.scrollTop = panScrollRef.current.y - dy;
      return;
    }

    // Hover detection for text tool
    if (activeTool === 'text' && !isDrawing && !editingText && draggingIdx === null) {
      const pos = getPos(e);
      const hit = findTextItemAt(pos.x, pos.y);
      if (hit !== hoveredTextItem) setHoveredTextItem(hit);
    }

    // Dragging annotation
    // Dragging / Resizing / Rotating annotation
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
          const diff = currentAngle - startAngle;
          nextAnn.rotation = (ann.rotation || 0) + diff;
        } else {
          if (ann.type === 'rect' || ann.type === 'circle') {
            let x = start.ann.x;
            let y = start.ann.y;
            let w = start.ann.w;
            let h = start.ann.h;
            
            if (resizeDirection === 'nw') {
              x = start.ann.x + dx;
              y = start.ann.y + dy;
              w = start.ann.w - dx;
              h = start.ann.h - dy;
            } else if (resizeDirection === 'ne') {
              y = start.ann.y + dy;
              w = start.ann.w + dx;
              h = start.ann.h - dy;
            } else if (resizeDirection === 'sw') {
              x = start.ann.x + dx;
              w = start.ann.w - dx;
              h = start.ann.h + dy;
            } else if (resizeDirection === 'se') {
              w = start.ann.w + dx;
              h = start.ann.h + dy;
            }
            nextAnn.x = x;
            nextAnn.y = y;
            nextAnn.w = w;
            nextAnn.h = h;
          } else if (ann.type === 'text') {
            const scale = 1 + (resizeDirection.includes('e') ? dx : -dx) / Math.max(10, start.bounds.w);
            const nextFs = Math.max(8, Math.min(120, Math.round(start.ann.fontSize * scale)));
            nextAnn.fontSize = nextFs;
          } else if (ann.type === 'line' || ann.type === 'arrow') {
            if (resizeDirection === 'nw' || resizeDirection === 'sw') {
              nextAnn.x1 = start.ann.x1 + dx;
              nextAnn.y1 = start.ann.y1 + dy;
            } else {
              nextAnn.x2 = start.ann.x2 + dx;
              nextAnn.y2 = start.ann.y2 + dy;
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
      currentPage, computeGuides, editingText, findTextItemAt, hoveredTextItem, resizeDirection]);

  const handlePointerUp = useCallback((e) => {
    if (isPanning) {
      setIsPanning(false);
      panStartRef.current = null;
      return;
    }

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
      addAnn({ ...shapePreview, color: strokeColor, strokeWidth });
    }

    setIsDrawing(false);
    setCurrentPath([]);
    setShapeStart(null);
    setShapePreview(null);
  }, [isPanning, draggingIdx, isDrawing, activeTool, currentPath, shapePreview,
      strokeColor, strokeWidth, addAnn, pushHistory]);

  /* Commit text editing */
  const commitText = useCallback((value) => {
    if (!editingText) return;
    setGuides({ h: [], v: [] });

    // Resolve the font family to use
    const resolvedFont = selectedFont === 'auto'
      ? (editingText.matchedFont || '"Times New Roman", serif')
      : (FONT_OPTIONS.find(f => f.id === selectedFont)?.css || '"Times New Roman", serif');

    // Helper to build whiteout with sampled background color
    const buildWhiteout = (pi) => {
      let bgColor = '#ffffff';
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        // Sample background from area around the text (above the text baseline)
        const sampleY = Math.round(pi.y - pi.height * 0.5);
        const samplePoints = [
          [Math.round(pi.x - 5), sampleY],
          [Math.round(pi.x + pi.width + 5), sampleY],
          [Math.round(pi.x + pi.width / 2), Math.round(pi.y - pi.height - 3)],
        ];
        let totalR = 0, totalG = 0, totalB = 0, count = 0;
        for (const [sx, sy] of samplePoints) {
          if (sx >= 0 && sy >= 0 && sx < ctx.canvas.width && sy < ctx.canvas.height) {
            const pixel = ctx.getImageData(sx, sy, 1, 1).data;
            // Only use light pixels (background, not text)
            if (pixel[0] + pixel[1] + pixel[2] > 600) {
              totalR += pixel[0]; totalG += pixel[1]; totalB += pixel[2];
              count++;
            }
          }
        }
        if (count > 0) {
          bgColor = `rgb(${Math.round(totalR/count)}, ${Math.round(totalG/count)}, ${Math.round(totalB/count)})`;
        }
      }
      return {
        x: pi.x - 4,
        y: pi.y - pi.height - 4,
        w: pi.width + 8,
        h: pi.height + 10,
        bgColor,
      };
    };

    if (editingText.editIdx != null) {
      // Re-editing existing annotation
      if (value.trim()) {
        const fs = editingText.matchedFontSize || textSize;
        const fw = editingText.matchedBold ? 700 : 400;
        const fst = editingText.matchedItalic ? 'italic' : 'normal';
        const color = editingText.matchedColor || strokeColor;
        updateAnn(editingText.editIdx, {
          text: value,
          fontFamily: resolvedFont,
          fontSize: fs,
          fontWeight: fw,
          fontStyle: fst,
          color,
        });
      } else {
        deleteAnn(editingText.editIdx);
      }
    } else if (editingText.pdfTextItem && !value.trim()) {
      // User cleared all text from a PDF line → still apply whiteout to erase it
      if (value !== editingText.originalValue) {
        const pi = editingText.pdfTextItem;
        addAnn({
          type: 'text', x: editingText.x, y: editingText.y,
          text: '', color: 'transparent', fontSize: editingText.matchedFontSize || textSize,
          fontWeight: 400, fontStyle: 'normal', fontFamily: resolvedFont,
          whiteout: buildWhiteout(pi),
        });
      }
    } else if (value.trim()) {
      // Skip if clicking PDF text and leaving it unchanged
      if (editingText.pdfTextItem && value === editingText.originalValue) {
        setEditingText(null);
        return;
      }
      const fs = editingText.matchedFontSize || textSize;
      const fw = editingText.matchedBold ? 700 : 400;
      const fst = editingText.matchedItalic ? 'italic' : 'normal';
      const color = editingText.matchedColor || strokeColor;
      const annData = {
        type: 'text', x: editingText.x, y: editingText.y,
        text: value, color, fontSize: fs,
        fontWeight: fw, fontStyle: fst, fontFamily: resolvedFont,
      };
      if (editingText.pdfTextItem) {
        annData.whiteout = buildWhiteout(editingText.pdfTextItem);
      }
      addAnn(annData);
    }
    setEditingText(null);
  }, [editingText, updateAnn, deleteAnn, addAnn, strokeColor, textSize, selectedFont]);

  /* Double click to re-edit text */
  const handleDoubleClick = useCallback((e) => {
    const pos = getPos(e);
    for (let i = pageAnns.length - 1; i >= 0; i--) {
      if (pageAnns[i].type === 'text' && hitTest(pageAnns[i], pos.x, pos.y)) {
        const ann = pageAnns[i];
        setEditingText({
          x: ann.x, y: ann.y, value: ann.text, editIdx: i,
          matchedFontSize: ann.fontSize,
          matchedBold: ann.fontWeight >= 700,
          matchedItalic: ann.fontStyle === 'italic',
          matchedFont: ann.fontFamily,
          clickX: pos.x,
        });
        setSelectedIdx(null);
        setActiveTool('text');
        setTimeout(() => textInputRef.current?.focus(), 30);
        return;
      }
    }
  }, [pageAnns, getPos]);

  /* ================================================================
     Wheel: zoom / scroll
     ================================================================ */
  const handleWheel = useCallback((e) => {
    if (!scrollRef.current) return;
    if (e.shiftKey) {
      e.preventDefault();
      scrollRef.current.scrollLeft += e.deltaY;
      return;
    }
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const d = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      setZoom(z => clamp(z + d, ZOOM_MIN, ZOOM_MAX));
      return;
    }
  }, []);

  const fitToWidth = useCallback(() => {
    if (!scrollRef.current || !pageSize.width) return;
    const availW = scrollRef.current.clientWidth - 64;
    setZoom(clamp(availW / pageSize.width, ZOOM_MIN, ZOOM_MAX));
  }, [pageSize]);

  /* ================================================================
     Context menu
     ================================================================ */
  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
    const pos = getPos(e);
    let hitIdx = null;
    for (let i = pageAnns.length - 1; i >= 0; i--) {
      if (hitTest(pageAnns[i], pos.x, pos.y)) { hitIdx = i; break; }
    }
    setContextMenu({ x: e.clientX, y: e.clientY, annIdx: hitIdx, pos });
    if (hitIdx !== null) setSelectedIdx(hitIdx);
  }, [pageAnns, getPos]);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    window.addEventListener('contextmenu', close);
    return () => { window.removeEventListener('click', close); window.removeEventListener('contextmenu', close); };
  }, [contextMenu]);

  /* ================================================================
     Keyboard shortcuts
     ================================================================ */
  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      const key = e.key.toLowerCase();
      const ctrl = e.ctrlKey || e.metaKey;

      if (e.code === 'Space' && !ctrl) {
        e.preventDefault(); setSpaceHeld(true); return;
      }

      const tm = { v: 'select', t: 'text', p: 'draw', h: 'highlight', r: 'rect', e: 'circle', l: 'line', a: 'arrow', x: 'eraser' };
      if (tm[key] && !ctrl && !e.shiftKey && !e.altKey) {
        setActiveTool(tm[key]); setSelectedIdx(null); e.preventDefault(); return;
      }

      if (ctrl && key === 'z' && !e.shiftKey) { undo(); e.preventDefault(); return; }
      if (ctrl && ((key === 'z' && e.shiftKey) || key === 'y')) { redo(); e.preventDefault(); return; }
      if (ctrl && key === 'd' && selectedIdx !== null) { duplicateAnn(selectedIdx); e.preventDefault(); return; }
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
  }, [selectedIdx, currentPage, totalPages, deleteAnn, duplicateAnn, undo, redo, fitToWidth, setAnnsH]);

  /* ================================================================
     Export PDF
     ================================================================ */
  const exportPdf = async () => {
    let bytesToLoad = pdfBytesRef.current || pdfBytes;
    const isDetached = bytesToLoad && (bytesToLoad.byteLength === 0 || bytesToLoad.buffer?.byteLength === 0);
    if ((!bytesToLoad || isDetached) && file) {
      try {
        const arr = await file.arrayBuffer();
        bytesToLoad = new Uint8Array(arr);
        pdfBytesRef.current = bytesToLoad;
      } catch (err) {
        console.error('Failed to reload file arrayBuffer:', err);
      }
    }
    if (!bytesToLoad) return;
    
    // Strip any React proxy wrapper by creating a clean Uint8Array copy
    const cleanBytes = new Uint8Array(bytesToLoad);
    
    setProcessing(true);
    try {
      const doc = await PDFDocument.load(cleanBytes);
      // Embed serif, sans-serif, and monospace font families (including all styles)
      const sansFont = await doc.embedFont(StandardFonts.Helvetica);
      const sansBold = await doc.embedFont(StandardFonts.HelveticaBold);
      const sansItalic = await doc.embedFont(StandardFonts.HelveticaOblique);
      const sansBoldItalic = await doc.embedFont(StandardFonts.HelveticaBoldOblique);
      
      const serifFont = await doc.embedFont(StandardFonts.TimesRoman);
      const serifBold = await doc.embedFont(StandardFonts.TimesRomanBold);
      const serifItalic = await doc.embedFont(StandardFonts.TimesRomanItalic);
      const serifBoldItalic = await doc.embedFont(StandardFonts.TimesRomanBoldItalic);
      
      const monoFont = await doc.embedFont(StandardFonts.Courier);
      const monoBold = await doc.embedFont(StandardFonts.CourierBold);
      const monoItalic = await doc.embedFont(StandardFonts.CourierOblique);
      const monoBoldItalic = await doc.embedFont(StandardFonts.CourierBoldOblique);
      
      const pages = doc.getPages();

      Object.entries(annotations).forEach(([pageNum, anns]) => {
        const page = pages[parseInt(pageNum) - 1];
        if (!page) return;
        const { width, height } = page.getSize();
        const sx = width / pageSize.width;
        const sy = height / pageSize.height;

        anns.forEach(ann => {
          const color = hexToRgb(ann.color);
          const sw = (ann.strokeWidth || 3) * sx;
          const rot = ann.rotation ? degrees(-(ann.rotation * 180) / Math.PI) : undefined;

          if (ann.type === 'text') {
            // Whiteout first
            if (ann.whiteout) {
              const wo = ann.whiteout;
              // Use sampled bg color or default to white
              let woColor = rgb(1, 1, 1);
              if (wo.bgColor && wo.bgColor !== '#ffffff') {
                const m = wo.bgColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
                if (m) woColor = rgb(+m[1]/255, +m[2]/255, +m[3]/255);
              }
              page.drawRectangle({
                x: wo.x * sx,
                y: height - (wo.y + wo.h) * sy,
                width: wo.w * sx, height: wo.h * sy,
                color: woColor, borderWidth: 0,
              });
            }
            // Select font family based on annotation's stored fontFamily
            const ff = ann.fontFamily || '';
            const isSerif = /times|georgia|garamond|palatino|serif/i.test(ff) && !/sans/i.test(ff);
            const isMono = /courier|mono/i.test(ff);
            let useFont;
            const isBold = ann.fontWeight >= 700;
            const isItalic = ann.fontStyle === 'italic';

            if (isMono) {
              if (isBold && isItalic) useFont = monoBoldItalic;
              else if (isBold) useFont = monoBold;
              else if (isItalic) useFont = monoItalic;
              else useFont = monoFont;
            } else if (isSerif) {
              if (isBold && isItalic) useFont = serifBoldItalic;
              else if (isBold) useFont = serifBold;
              else if (isItalic) useFont = serifItalic;
              else useFont = serifFont;
            } else {
              if (isBold && isItalic) useFont = sansBoldItalic;
              else if (isBold) useFont = sansBold;
              else if (isItalic) useFont = sansItalic;
              else useFont = sansFont;
            }
            const lines = (ann.text || '').split('\n');
            const lh = ann.fontSize * 1.25;
            lines.forEach((line, li) => {
              if (line.trim()) {
                page.drawText(line, {
                  x: ann.x * sx,
                  y: height - (ann.y + li * lh) * sy,
                  size: ann.fontSize * sy,
                  font: useFont, color,
                  rotate: rot,
                });
              }
            });
          } else if (ann.type === 'path') {
            for (let i = 1; i < ann.points.length; i++) {
              page.drawLine({
                start: { x: ann.points[i - 1].x * sx, y: height - ann.points[i - 1].y * sy },
                end: { x: ann.points[i].x * sx, y: height - ann.points[i].y * sy },
                thickness: sw, color,
              });
            }
          } else if (ann.type === 'highlight') {
            for (let i = 1; i < ann.points.length; i++) {
              page.drawLine({
                start: { x: ann.points[i - 1].x * sx, y: height - ann.points[i - 1].y * sy },
                end: { x: ann.points[i].x * sx, y: height - ann.points[i].y * sy },
                thickness: sw, color, opacity: 0.35,
              });
            }
          } else if (ann.type === 'rect') {
            const rx = ann.w >= 0 ? ann.x * sx : (ann.x + ann.w) * sx;
            const ry = ann.h >= 0 ? height - (ann.y + ann.h) * sy : height - ann.y * sy;
            page.drawRectangle({
              x: rx, y: ry,
              width: Math.abs(ann.w) * sx, height: Math.abs(ann.h) * sy,
              borderColor: color, borderWidth: sw,
              rotate: rot,
            });
          } else if (ann.type === 'circle') {
            page.drawEllipse({
              x: (ann.x + ann.w / 2) * sx,
              y: height - (ann.y + ann.h / 2) * sy,
              xScale: Math.abs(ann.w) / 2 * sx || 1,
              yScale: Math.abs(ann.h) / 2 * sy || 1,
              borderColor: color, borderWidth: sw,
              rotate: rot,
            });
          } else if (ann.type === 'line' || ann.type === 'arrow') {
            page.drawLine({
              start: { x: ann.x1 * sx, y: height - ann.y1 * sy },
              end: { x: ann.x2 * sx, y: height - ann.y2 * sy },
              thickness: sw, color,
            });
            if (ann.type === 'arrow') {
              const angle = Math.atan2(ann.y2 - ann.y1, ann.x2 - ann.x1);
              const hl = 12 + (ann.strokeWidth || 3) * 2;
              page.drawLine({
                start: { x: ann.x2 * sx, y: height - ann.y2 * sy },
                end: {
                  x: (ann.x2 - hl * Math.cos(angle - 0.4)) * sx,
                  y: height - (ann.y2 - hl * Math.sin(angle - 0.4)) * sy,
                },
                thickness: sw, color,
              });
              page.drawLine({
                start: { x: ann.x2 * sx, y: height - ann.y2 * sy },
                end: {
                  x: (ann.x2 - hl * Math.cos(angle + 0.4)) * sx,
                  y: height - (ann.y2 - hl * Math.sin(angle + 0.4)) * sy,
                },
                thickness: sw, color,
              });
            }
          }
        });
      });

      const outBytes = await doc.save();
      const name = file.name.replace(/\.pdf$/i, '') + '_edited.pdf';
      saveAs(new Blob([outBytes], { type: 'application/pdf' }), name);
    } catch (err) {
      alert('Export error: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  /* ================================================================
     Cursor
     ================================================================ */
  const cursor = useMemo(() => {
    if (spaceHeld || isPanning) return 'grab';
    if (activeTool === 'text' && hoveredTextItem) return 'text';
    const m = {
      select: 'default', text: 'text', eraser: 'crosshair',
      draw: 'crosshair', highlight: 'crosshair',
      rect: 'crosshair', circle: 'crosshair',
      line: 'crosshair', arrow: 'crosshair',
    };
    return m[activeTool] || 'crosshair';
  }, [activeTool, spaceHeld, isPanning, hoveredTextItem]);

  /* ================================================================
     RENDER: Drop zone (no file)
     ================================================================ */
  if (!file) {
    return (
      <div className="main-content">
        <div className="workspace">
          {tool && (
            <div className="ws-header">
              <span className="ws-emoji">{tool.icon}</span>
              <div className="ws-info">
                <h2>{tool.title}</h2>
                <p>{tool.desc}</p>
              </div>
            </div>
          )}
          <div
            className={`dropzone${dragOver ? ' dragover' : ''}`}
            onClick={() => inputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <div className="dropzone-icon">{'\u270F\uFE0F'}</div>
            <div className="dropzone-text">
              <strong>Drop a PDF here</strong> or click to browse
            </div>
            <input ref={inputRef} type="file" accept=".pdf" hidden
              onChange={e => { loadFile(e.target.files[0]); e.target.value = ''; }} />
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="main-content">
        <div className="workspace">
          {tool && (
            <div className="ws-header">
              <span className="ws-emoji">{tool.icon}</span>
              <div className="ws-info">
                <h2>{tool.title}</h2>
                <p>{tool.desc}</p>
              </div>
            </div>
          )}
          <div className="progress-text" style={{ textAlign: 'center', padding: '3rem 0' }}>Loading PDF...</div>
        </div>
      </div>
    );
  }

  /* ================================================================
     RENDER: Editor
     ================================================================ */
  return (
    <div style={S.wrapper}>
      {/* ---- Main body ---- */}
      <div style={S.body}>

        {/* Thumbnail strip (toggled with Ctrl+L) */}
        <div style={S.thumbStrip(showThumbs)}>
          {showThumbs && Array.from({ length: totalPages }, (_, i) => i + 1).map(pg => (
            <div key={pg} style={S.thumbItem(pg === currentPage)}
              onClick={() => { setCurrentPage(pg); setSelectedIdx(null); }}>
              {thumbnails[pg]
                ? <img src={thumbnails[pg]} alt={`Page ${pg}`} style={{ width: 54, borderRadius: 2, display: 'block' }} />
                : <div style={{ width: 54, height: 70, background: 'var(--bg2)', borderRadius: 2,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, color: 'var(--text-muted)' }}>...</div>}
              <span style={S.thumbLabel}>{pg}</span>
            </div>
          ))}
        </div>

        {/* Left toolbar */}
        <div
          className="left-toolbar-controls"
          onPointerDown={() => { isInteractingWithToolbarRef.current = true; }}
          onPointerUp={() => { setTimeout(() => { isInteractingWithToolbarRef.current = false; }, 100); }}
          style={S.toolStrip(toolStripWidth)}
        >
          {/* Resize handle on right edge */}
          <div
            style={{
              position: 'absolute', top: 0, right: -3, width: 6, height: '100%',
              cursor: 'col-resize', zIndex: 10,
            }}
            onPointerDown={e => {
              e.preventDefault();
              toolStripResizing.current = true;
              const startX = e.clientX;
              const startW = toolStripWidth;
              const onMove = (me) => {
                if (!toolStripResizing.current) return;
                const newW = Math.max(44, Math.min(180, startW + (me.clientX - startX)));
                setToolStripWidth(newW);
              };
              const onUp = () => {
                toolStripResizing.current = false;
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', onUp);
              };
              window.addEventListener('pointermove', onMove);
              window.addEventListener('pointerup', onUp);
            }}
          />
          {TOOL_DEFS.map((t, i) => {
            const prevGroup = i > 0 ? TOOL_DEFS[i - 1].group : t.group;
            const isWide = toolStripWidth > 85;
            return (
              <div key={t.id} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {i > 0 && t.group !== prevGroup && <div style={{ ...S.toolDivider, width: isWide ? '85%' : 22 }} />}
                <button
                  style={S.toolBtn(activeTool === t.id, toolStripWidth)}
                  onClick={() => { setActiveTool(t.id); setSelectedIdx(null); }}
                  onMouseEnter={() => setHoveredTool(t.id)}
                  onMouseLeave={() => setHoveredTool(null)}
                  title={`${t.label} (${t.shortcut})`}
                >
                  <span style={{ fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{t.icon}</span>
                  {isWide && (
                    <span style={{ fontSize: 11, fontWeight: 500, color: activeTool === t.id ? 'var(--cat-edit)' : 'var(--sketch-text)' }}>
                      {t.label}
                    </span>
                  )}
                  {!isWide && hoveredTool === t.id && (
                    <span style={{ ...S.tooltip, opacity: 1 }}>
                      {t.label} <span style={{ opacity: 0.5 }}>{t.shortcut}</span>
                    </span>
                  )}
                </button>
              </div>
            );
          })}

          <div style={{ ...S.toolDivider, width: toolStripWidth > 85 ? '85%' : 22 }} />

          {/* Figma-style custom color picker */}
          <div style={{
            display: 'flex',
            flexDirection: toolStripWidth > 85 ? 'row' : 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '0 4px',
            width: '100%',
          }}>
            {toolStripWidth > 85 && <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)' }}>COLOR</span>}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: toolStripWidth > 85 ? 'var(--bg2)' : 'transparent',
              padding: toolStripWidth > 85 ? '3px 6px' : 0,
              borderRadius: 6,
              border: toolStripWidth > 85 ? '1px solid var(--border)' : 'none',
              cursor: 'pointer',
              position: 'relative',
              boxShadow: toolStripWidth > 85 ? 'inset 0 1px 2px rgba(0,0,0,0.04)' : 'none',
            }} title="Select Custom Color">
              {/* Color Circle */}
              <div style={{
                width: 16, height: 16,
                borderRadius: '50%',
                background: strokeColor,
                border: '1.5px solid var(--border)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                flexShrink: 0,
              }} />
              
              {/* Hex Code Input (Visible only if wide) */}
              {toolStripWidth > 85 && (
                <span style={{
                  fontSize: 10,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--sketch-text)',
                  textTransform: 'uppercase',
                  userSelect: 'none',
                  letterSpacing: '0.02em',
                }}>
                  {strokeColor}
                </span>
              )}

              {/* Hidden native Color Picker */}
              <input
                type="color"
                value={strokeColor.startsWith('#') ? strokeColor : '#1a1a1a'}
                onChange={e => {
                  const val = e.target.value;
                  if (editingText) {
                    setEditingText(prev => ({ ...prev, matchedColor: val }));
                  }
                  setStrokeColorSync(val);
                }}
                style={{
                  position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                  border: 'none', padding: 0, opacity: 0, cursor: 'pointer',
                }}
              />
            </div>
          </div>

          {['draw', 'highlight', 'rect', 'circle', 'line', 'arrow'].includes(activeTool) && (
            <>
              <div style={{ ...S.toolDivider, width: toolStripWidth > 85 ? '85%' : 22 }} />
              {/* Stroke size */}
              <div style={{
                display: 'flex',
                flexDirection: toolStripWidth > 85 ? 'row' : 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '0 4px',
                width: '100%',
              }}>
                {toolStripWidth > 85 && <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)' }}>PEN</span>}
                <input type="range" min={1} max={16} value={strokeWidth}
                  onChange={e => setStrokeWidthSync(Number(e.target.value))}
                  style={{
                    width: toolStripWidth > 85 ? '50%' : 30,
                    height: 18,
                    accentColor: 'var(--cat-edit)',
                    cursor: 'pointer',
                  }}
                  title="Pen Stroke Size"
                />
                <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{strokeWidth}</span>
              </div>
            </>
          )}

          {activeTool === 'text' && (
            <>
              <div style={{ ...S.toolDivider, width: toolStripWidth > 85 ? '85%' : 22 }} />
              {/* Text Size */}
              <div style={{
                display: 'flex',
                flexDirection: toolStripWidth > 85 ? 'row' : 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '0 4px',
                width: '100%',
              }}>
                {toolStripWidth > 85 && <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)' }}>SIZE</span>}
                <input type="range" min={8} max={72} value={textSize}
                  onChange={e => {
                    const val = Number(e.target.value);
                    if (editingText) {
                      setEditingText(prev => ({ ...prev, matchedFontSize: val }));
                    }
                    setTextSizeSync(val);
                  }}
                  style={{
                    width: toolStripWidth > 85 ? '50%' : 30,
                    height: 18,
                    accentColor: 'var(--cat-edit)',
                    cursor: 'pointer',
                  }}
                  title="Font Size"
                />
                <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{textSize}</span>
              </div>
              
              {/* Font Family */}
              <div style={{
                display: 'flex',
                flexDirection: toolStripWidth > 85 ? 'row' : 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                padding: '0 4px',
                width: '100%',
                marginTop: 2,
              }}>
                {toolStripWidth > 85 && <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)' }}>FONT</span>}
                <select value={selectedFont}
                  onChange={e => {
                    const val = e.target.value;
                    setSelectedFontSync(val);
                  }}
                  style={{
                    width: toolStripWidth > 85 ? '65%' : 38,
                    fontSize: 8, padding: '2px 1px',
                    border: '1px solid var(--border)', borderRadius: 3,
                    background: 'var(--surface)', color: 'var(--sketch-text)',
                    fontFamily: 'var(--font-sans)', cursor: 'pointer',
                    textOverflow: 'ellipsis',
                  }}>
                  {FONT_OPTIONS.map(f => {
                    let label = f.label;
                    if (f.id === 'auto' && editingText) {
                      const resolved = editingText.matchedFont || '"Times New Roman", serif';
                      const isSerif = /times|georgia|garamond|palatino|serif/i.test(resolved) && !/sans/i.test(resolved);
                      const isMono = /courier|mono/i.test(resolved);
                      const displayFamily = isMono ? 'Mono' : (isSerif ? 'Serif' : 'Sans');
                      label = `Auto (${displayFamily})`;
                    }
                    return (
                      <option key={f.id} value={f.id} style={{ fontFamily: f.css !== 'auto' ? f.css : undefined }}>
                        {label}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Bold & Italic Toggles */}
              <div style={{
                display: 'flex',
                flexDirection: toolStripWidth > 85 ? 'row' : 'column',
                gap: 4,
                justifyContent: 'center',
                alignItems: 'center',
                width: '100%',
                marginTop: 6,
              }}>
                {toolStripWidth > 85 && <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', marginRight: 2 }}>STYLE</span>}
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    onClick={() => {
                      const nextVal = !(editingText ? editingText.matchedBold : textBold);
                      if (editingText) {
                        setEditingText(prev => ({ ...prev, matchedBold: nextVal }));
                      }
                      setTextBoldSync(nextVal);
                    }}
                    style={{
                      width: 24, height: 24,
                      borderRadius: 4,
                      border: '1px solid var(--border)',
                      background: (editingText ? editingText.matchedBold : textBold) ? 'var(--cat-edit-bg)' : 'var(--surface)',
                      color: (editingText ? editingText.matchedBold : textBold) ? 'var(--cat-edit)' : 'var(--sketch-text)',
                      fontFamily: 'var(--font-sans)',
                      fontWeight: 'bold',
                      fontSize: 10,
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                    title="Bold"
                  >
                    B
                  </button>
                  <button
                    onClick={() => {
                      const nextVal = !(editingText ? editingText.matchedItalic : textItalic);
                      if (editingText) {
                        setEditingText(prev => ({ ...prev, matchedItalic: nextVal }));
                      }
                      setTextItalicSync(nextVal);
                    }}
                    style={{
                      width: 24, height: 24,
                      borderRadius: 4,
                      border: '1px solid var(--border)',
                      background: (editingText ? editingText.matchedItalic : textItalic) ? 'var(--cat-edit-bg)' : 'var(--surface)',
                      color: (editingText ? editingText.matchedItalic : textItalic) ? 'var(--cat-edit)' : 'var(--sketch-text)',
                      fontFamily: 'var(--font-sans)',
                      fontStyle: 'italic',
                      fontSize: 10,
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                    title="Italic"
                  >
                    I
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Center canvas area */}
        <div style={{ ...S.canvasArea, cursor }} onWheel={handleWheel}>
          <div ref={scrollRef} style={S.canvasScroller}>
            <div style={S.canvasContainer(zoom)}>
              <canvas ref={canvasRef} style={S.pageShadow} />
              <canvas ref={overlayRef}
                style={{
                  position: 'absolute', top: 0, left: 0,
                  width: pageSize.width, height: pageSize.height,
                  pointerEvents: editingText ? 'none' : 'auto',
                }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onDoubleClick={handleDoubleClick}
                onContextMenu={handleContextMenu} />

              {/* Inline text editor */}
              {editingText && (() => {
                const isPdfText = !!editingText.pdfTextItem;
                const fs = editingText.matchedFontSize || textSize;
                const lineW = isPdfText ? editingText.pdfTextItem.width + 8 : undefined;
                const resolvedFontCSS = selectedFont === 'auto'
                  ? (editingText.matchedFont || '"Times New Roman", serif')
                  : (FONT_OPTIONS.find(f => f.id === selectedFont)?.css || '"Times New Roman", serif');
                const floatingBarY = editingText.y - fs - 42;
                return (
                <>
                  {/* Floating formatting bar */}
                  <div
                    className="formatting-bar"
                    onPointerDown={() => { isInteractingWithToolbarRef.current = true; }}
                    onPointerUp={() => { setTimeout(() => { isInteractingWithToolbarRef.current = false; }, 100); }}
                    style={{
                      position: 'absolute',
                      left: editingText.x,
                      top: floatingBarY,
                      zIndex: 101,
                      display: 'flex',
                      gap: 5,
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      padding: '4px 6px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                      alignItems: 'center',
                      pointerEvents: 'auto',
                    }}>
                    {/* Font family */}
                    <select
                      value={selectedFont}
                      onChange={e => setSelectedFont(e.target.value)}
                      style={{
                        fontSize: 9, padding: '2px 4px',
                        border: '1px solid var(--border)', borderRadius: 4,
                        background: 'var(--bg2)', color: 'var(--sketch-text)',
                        fontFamily: 'var(--font-sans)', cursor: 'pointer',
                        width: 72, textOverflow: 'ellipsis',
                      }}
                    >
                      {FONT_OPTIONS.map(f => {
                        let label = f.label;
                        if (f.id === 'auto') {
                          const resolved = editingText.matchedFont || '"Times New Roman", serif';
                          const isSerif = /times|georgia|garamond|palatino|serif/i.test(resolved) && !/sans/i.test(resolved);
                          const isMono = /courier|mono/i.test(resolved);
                          const displayFamily = isMono ? 'Mono' : (isSerif ? 'Serif' : 'Sans');
                          label = `Auto (${displayFamily})`;
                        }
                        return (
                          <option key={f.id} value={f.id}>
                            {label}
                          </option>
                        );
                      })}
                    </select>

                    {/* Font size adjustment */}
                    <button
                      onClick={() => {
                        const cur = editingText.matchedFontSize || textSize;
                        const next = Math.max(8, cur - 1);
                        setEditingText(prev => ({ ...prev, matchedFontSize: next }));
                        setTextSize(next);
                      }}
                      style={{ border: 'none', background: 'none', fontSize: 11, cursor: 'pointer', color: 'var(--sketch-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: 3 }}
                      onMouseEnter={e => e.target.style.background = 'var(--bg2)'}
                      onMouseLeave={e => e.target.style.background = 'none'}
                    >
                      A-
                    </button>
                    <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', minWidth: 16, textAlign: 'center', color: 'var(--sketch-text)' }}>
                      {editingText.matchedFontSize || textSize}
                    </span>
                    <button
                      onClick={() => {
                        const cur = editingText.matchedFontSize || textSize;
                        const next = Math.min(72, cur + 1);
                        setEditingText(prev => ({ ...prev, matchedFontSize: next }));
                        setTextSize(next);
                      }}
                      style={{ border: 'none', background: 'none', fontSize: 11, cursor: 'pointer', color: 'var(--sketch-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: 3 }}
                      onMouseEnter={e => e.target.style.background = 'var(--bg2)'}
                      onMouseLeave={e => e.target.style.background = 'none'}
                    >
                      A+
                    </button>

                    <div style={{ width: 1, height: 12, background: 'var(--border)' }} />

                    {/* Bold Toggle */}
                    <button
                      onClick={() => {
                        setEditingText(prev => ({ ...prev, matchedBold: !prev.matchedBold }));
                      }}
                      style={{
                        width: 18, height: 18, borderRadius: 3, border: 'none',
                        background: editingText.matchedBold ? 'var(--cat-edit-bg)' : 'none',
                        color: editingText.matchedBold ? 'var(--cat-edit)' : 'var(--sketch-text)',
                        fontWeight: 'bold', fontSize: 10, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}
                    >
                      B
                    </button>

                    {/* Italic Toggle */}
                    <button
                      onClick={() => {
                        setEditingText(prev => ({ ...prev, matchedItalic: !prev.matchedItalic }));
                      }}
                      style={{
                        width: 18, height: 18, borderRadius: 3, border: 'none',
                        background: editingText.matchedItalic ? 'var(--cat-edit-bg)' : 'none',
                        color: editingText.matchedItalic ? 'var(--cat-edit)' : 'var(--sketch-text)',
                        fontStyle: 'italic', fontSize: 10, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}
                    >
                      I
                    </button>

                    <div style={{ width: 1, height: 12, background: 'var(--border)' }} />

                    {/* Color indicator / selector */}
                    <div style={{
                      position: 'relative',
                      width: 14, height: 14,
                      borderRadius: '50%',
                      border: '1px solid var(--border)',
                      background: editingText.matchedColor || strokeColor,
                      cursor: 'pointer',
                    }} title="Text Color">
                      <input
                        type="color"
                        value={editingText.matchedColor || strokeColor}
                        onChange={e => {
                          const val = e.target.value;
                          setEditingText(prev => ({ ...prev, matchedColor: val }));
                          setStrokeColor(val);
                        }}
                        style={{
                          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                          border: 'none', padding: 0, opacity: 0, cursor: 'pointer',
                        }}
                      />
                    </div>

                    <div style={{ width: 1, height: 12, background: 'var(--border)' }} />

                    {/* Save Button */}
                    <button
                      onClick={() => {
                        commitText();
                      }}
                      style={{
                        border: 'none', background: 'var(--cat-edit)', color: '#fff',
                        borderRadius: 3, fontSize: 8, padding: '2px 5px', fontWeight: 600,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2,
                      }}
                    >
                      ✓ Save
                    </button>
                  </div>

                <textarea
                  ref={el => {
                    textInputRef.current = el;
                    if (el && editingText?.clickX != null) {
                      // Estimate cursor position from click X coordinate
                      const text = editingText.value || '';
                      if (text.length > 0) {
                        const relX = editingText.clickX - editingText.x;
                        const isBold = editingText.matchedBold;
                        // Measure character widths using a temporary canvas
                        const mc = document.createElement('canvas').getContext('2d');
                        const wt = isBold ? 700 : 400;
                        const st = editingText.matchedItalic ? 'italic ' : '';
                        mc.font = `${st}${wt} ${fs}px ${resolvedFontCSS}`;
                        let cursorIdx = text.length;
                        for (let i = 0; i < text.length; i++) {
                          const w = mc.measureText(text.substring(0, i + 1)).width;
                          const prevW = i > 0 ? mc.measureText(text.substring(0, i)).width : 0;
                          const charMid = prevW + (w - prevW) / 2;
                          if (relX < charMid) {
                            cursorIdx = i;
                            break;
                          }
                        }
                        const savedClickX = editingText.clickX;
                        // Clear clickX so re-renders don't reset cursor
                        editingText.clickX = null;
                        // Use requestAnimationFrame to set cursor after React renders
                        requestAnimationFrame(() => {
                          if (el && el === textInputRef.current) {
                            el.setSelectionRange(cursorIdx, cursorIdx);
                            // For PDF text with nowrap, scroll textarea to show cursor
                            if (isPdfText) {
                              const cursorPixelX = mc.measureText(text.substring(0, cursorIdx)).width;
                              const visibleW = el.clientWidth;
                              // Center cursor in visible area
                              el.scrollLeft = Math.max(0, cursorPixelX - visibleW / 2);
                            }
                          }
                        });
                      } else {
                        editingText.clickX = null;
                      }
                    }
                  }}
                  key={`te-${editingText.x}-${editingText.y}-${editingText.editIdx}`}
                  autoFocus
                  defaultValue={editingText.value || ''}
                  placeholder="Type..."
                  rows={1}
                  style={{
                    position: 'absolute',
                    left: editingText.x,
                    top: editingText.y - fs,
                    fontSize: fs,
                    fontFamily: resolvedFontCSS,
                    fontWeight: editingText.matchedBold ? 700 : 400,
                    fontStyle: editingText.matchedItalic ? 'italic' : 'normal',
                    color: editingText.matchedColor
                      || (editingText.editIdx != null ? pageAnns[editingText.editIdx]?.color : null)
                      || strokeColor,
                    background: isPdfText ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.06)',
                    border: 'none',
                    borderBottom: '2px solid var(--cat-edit)',
                    borderRadius: 0,
                    padding: '2px 3px',
                    outline: 'none',
                    // PDF text: fixed line width, no wrap; New text: auto-grow
                    width: isPdfText ? Math.min(lineW, pageSize.width - editingText.x - 4) : undefined,
                    minWidth: isPdfText ? undefined : 60,
                    maxWidth: pageSize.width - editingText.x - 4,
                    resize: 'none',
                    overflowX: isPdfText ? 'auto' : 'hidden',
                    overflowY: 'hidden',
                    lineHeight: 1.25, zIndex: 100,
                    caretColor: 'var(--cat-edit)',
                    whiteSpace: isPdfText ? 'nowrap' : 'pre-wrap',
                    wordBreak: isPdfText ? 'normal' : 'break-word',
                    // PDF text: fixed single-line height
                    height: isPdfText ? Math.round(fs * 1.25 + 8) : undefined,
                    boxShadow: isPdfText
                      ? '0 0 0 1px rgba(106,76,147,0.2), 0 2px 8px rgba(0,0,0,0.08)'
                      : 'none',
                    pointerEvents: 'auto',
                  }}
                  onInput={e => {
                    if (!isPdfText) {
                      // New text: auto-grow height and width
                      e.target.style.height = 'auto';
                      e.target.style.height = e.target.scrollHeight + 'px';
                      e.target.style.width = 'auto';
                      e.target.style.width = Math.max(60, Math.min(e.target.scrollWidth + 10, pageSize.width - editingText.x - 4)) + 'px';
                    }
                    // PDF text: width stays fixed to original line width
                  }}
                  onKeyDown={e => {
                    e.stopPropagation();
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitText(e.target.value); }
                    if (e.key === 'Escape') { e.preventDefault(); setEditingText(null); setGuides({ h: [], v: [] }); }
                  }}
                  onBlur={e => {
                    const val = e.target.value;
                    setTimeout(() => {
                      if (isInteractingWithToolbarRef.current) {
                        textInputRef.current?.focus();
                        return;
                      }
                      if (document.activeElement !== textInputRef.current) {
                        commitText(val);
                      }
                    }, 150);
                  }}
                  onPointerDown={e => e.stopPropagation()}
                  onClick={e => e.stopPropagation()}
                />
                </>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div style={S.rightPanel(showLayers)}>
          {showLayers && (
            <>
              {/* Layers list */}
              <div style={{ ...S.panelSection, flex: 1, overflowY: 'auto' }}>
                <div style={{ ...S.panelTitle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Layers</span>
                  {pageAnns.length > 0 && (
                    <span style={S.badge}>{pageAnns.length}</span>
                  )}
                </div>
                {pageAnns.length === 0 ? (
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-sans)', padding: '8px 0', lineHeight: 1.5 }}>
                    No annotations on this page.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {[...pageAnns].reverse().map((ann, ri) => {
                      const idx = pageAnns.length - 1 - ri;
                      return (
                        <div key={ann.id || idx} style={S.layerItem(selectedIdx === idx)}
                          onClick={() => {
                            setSelectedIdx(idx);
                            setActiveTool('select');
                            
                            // Synchronize sidebar properties
                            const selectedAnn = pageAnns[idx];
                            if (selectedAnn) {
                              if (selectedAnn.color) setStrokeColor(selectedAnn.color);
                              if (selectedAnn.strokeWidth) setStrokeWidth(selectedAnn.strokeWidth);
                              if (selectedAnn.type === 'text') {
                                if (selectedAnn.fontSize) setTextSize(selectedAnn.fontSize);
                                setTextBold(selectedAnn.fontWeight >= 700);
                                setTextItalic(selectedAnn.fontStyle === 'italic');
                                const matchFontOption = FONT_OPTIONS.find(f => f.css === selectedAnn.fontFamily);
                                if (matchFontOption) setSelectedFont(matchFontOption.id);
                                else setSelectedFont('auto');
                              }
                            }
                          }}>
                          <span style={S.layerIcon}>{TYPE_ICONS[ann.type] || '?'}</span>
                          <span style={S.layerDot(ann.color)} />
                          <span style={S.layerName}>
                            {ann.type === 'text'
                              ? `"${(ann.text || '').slice(0, 14)}${(ann.text || '').length > 14 ? '..' : ''}"`
                              : TYPE_LABELS[ann.type] || ann.type}
                          </span>
                          <button style={S.layerDel}
                            onClick={(e) => { e.stopPropagation(); deleteAnn(idx); }}
                            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                            onMouseLeave={e => e.currentTarget.style.opacity = '0.5'}
                            title="Delete">{'\u00D7'}</button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Properties panel when annotation selected */}
              {selectedIdx !== null && pageAnns[selectedIdx] && (
                <div style={S.panelSection}>
                  <div style={S.panelTitle}>Properties</div>
                  <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', lineHeight: 1.8 }}>
                    {(() => {
                      const ann = pageAnns[selectedIdx];
                      const b = getBounds(ann);
                      return (
                        <>
                          <div>type: {TYPE_LABELS[ann.type] || ann.type}</div>
                          <div>x: {Math.round(b.x)} y: {Math.round(b.y)}</div>
                          <div>w: {Math.round(b.w)} h: {Math.round(b.h)}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            color: <span style={{ ...S.layerDot(ann.color), display: 'inline-block' }} /> {ann.color}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Stats */}
              <div style={{ ...S.panelSection, borderBottom: 'none' }}>
                <div style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', lineHeight: 1.8 }}>
                  <div>page {currentPage}: {pageAnns.length} annotations</div>
                  <div>total: {totalAnns} across {totalPages} pages</div>
                  <div>history: {historyIdx + 1}/{history.length}</div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ---- Status bar ---- */}
      <div style={S.statusBar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {/* File info */}
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 600, color: 'var(--sketch-text)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {file.name}
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-muted)' }}>
            {formatSize(file.size)}
          </span>

          <span style={{ width: 1, height: 14, background: 'var(--border)', margin: '0 3px' }} />

          {/* Page nav */}
          <button style={S.navBtn(currentPage <= 1)} disabled={currentPage <= 1}
            onClick={() => { setCurrentPage(p => Math.max(1, p - 1)); setSelectedIdx(null); }}>{'\u2190'}</button>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, minWidth: 32, textAlign: 'center' }}>
            {currentPage}/{totalPages}
          </span>
          <button style={S.navBtn(currentPage >= totalPages)} disabled={currentPage >= totalPages}
            onClick={() => { setCurrentPage(p => Math.min(totalPages, p + 1)); setSelectedIdx(null); }}>{'\u2192'}</button>

          <span style={{ width: 1, height: 14, background: 'var(--border)', margin: '0 3px' }} />

          {/* Zoom */}
          <button style={S.navBtn(false)} onClick={() => setZoom(z => clamp(z - 0.1, ZOOM_MIN, ZOOM_MAX))}>{'\u2212'}</button>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', minWidth: 30, textAlign: 'center' }}>
            {Math.round(zoom * 100)}%
          </span>
          <button style={S.navBtn(false)} onClick={() => setZoom(z => clamp(z + 0.1, ZOOM_MIN, ZOOM_MAX))}>+</button>
          <button style={{ ...S.navBtn(false), width: 'auto', padding: '0 5px', fontSize: 9, fontFamily: 'var(--font-sans)' }}
            onClick={fitToWidth} title="Fit to width (Ctrl+0)">fit</button>

          <span style={{ width: 1, height: 14, background: 'var(--border)', margin: '0 3px' }} />

          {/* Toggle buttons */}
          <button style={{
            ...S.navBtn(false), width: 'auto', padding: '0 5px', fontSize: 9,
            fontFamily: 'var(--font-sans)',
            background: showThumbs ? 'var(--cat-edit-bg)' : 'transparent',
            color: showThumbs ? 'var(--cat-edit)' : undefined,
            opacity: showThumbs ? 1 : 0.5,
          }} onClick={() => setShowThumbs(v => !v)} title="Toggle thumbnails (Ctrl+L)">pages</button>
          <button style={{
            ...S.navBtn(false), width: 'auto', padding: '0 5px', fontSize: 9,
            fontFamily: 'var(--font-sans)',
            background: showLayers ? 'var(--cat-edit-bg)' : 'transparent',
            color: showLayers ? 'var(--cat-edit)' : undefined,
            opacity: showLayers ? 1 : 0.5,
          }} onClick={() => setShowLayers(v => !v)} title="Toggle layers panel">layers</button>

          <span style={{ width: 1, height: 14, background: 'var(--border)', margin: '0 3px' }} />

          <button style={{ ...S.navBtn(false), width: 'auto', padding: '0 5px', fontSize: 9, fontFamily: 'var(--font-sans)' }}
            onClick={() => { setAnnsH(prev => ({ ...prev, [currentPage]: [] })); setSelectedIdx(null); }}>clear page</button>
          <button style={{ ...S.navBtn(false), width: 'auto', padding: '0 5px', fontSize: 9, fontFamily: 'var(--font-sans)' }}
            onClick={() => { setFile(null); setPdfDoc(null); setAnnotations({}); setPdfBytes(null); setThumbnails({}); }}>close</button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
            {totalAnns > 0 ? `${totalAnns} annotation${totalAnns > 1 ? 's' : ''}` : ''}
          </span>
          <button
            className="btn btn-primary"
            disabled={processing || totalAnns === 0}
            onClick={exportPdf}
            style={{ fontSize: 10, padding: '3px 12px', fontFamily: 'var(--font-sans)', fontWeight: 700 }}
          >
            {processing ? 'Exporting...' : 'Export PDF'}
          </button>
        </div>
      </div>

      {/* ---- Context menu ---- */}
      {contextMenu && (
        <div style={S.ctxMenu(contextMenu.x, contextMenu.y)}>
          {contextMenu.annIdx !== null ? (
            <>
              <button style={S.ctxItem(false)}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                onClick={() => {
                  setClipboard({ ann: cloneAnn(pageAnns[contextMenu.annIdx]), cut: true });
                  deleteAnn(contextMenu.annIdx); setContextMenu(null);
                }}>Cut</button>
              <button style={S.ctxItem(false)}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                onClick={() => {
                  setClipboard({ ann: cloneAnn(pageAnns[contextMenu.annIdx]) });
                  setContextMenu(null);
                }}>Copy</button>
              <button style={S.ctxItem(false)}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                onClick={() => { duplicateAnn(contextMenu.annIdx); setContextMenu(null); }}>Duplicate</button>
              <div style={S.ctxDivider} />
              <button style={S.ctxItem(false)}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                onClick={() => { bringForward(contextMenu.annIdx); setContextMenu(null); }}>Bring forward</button>
              <button style={S.ctxItem(false)}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                onClick={() => { sendBackward(contextMenu.annIdx); setContextMenu(null); }}>Send backward</button>
              <div style={S.ctxDivider} />
              <button style={S.ctxItem(true)}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                onClick={() => { deleteAnn(contextMenu.annIdx); setContextMenu(null); }}>Delete</button>
            </>
          ) : (
            <>
              {clipboard && (
                <button style={S.ctxItem(false)}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  onClick={() => {
                    const pasted = moveAnn(cloneAnn(clipboard.ann), 15, 15);
                    setAnnsH(prev => ({ ...prev, [currentPage]: [...(prev[currentPage] || []), pasted] }));
                    setSelectedIdx(pageAnns.length);
                    setContextMenu(null);
                  }}>Paste</button>
              )}
              <button style={S.ctxItem(true)}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                onClick={() => {
                  setAnnsH(prev => ({ ...prev, [currentPage]: [] }));
                  setSelectedIdx(null); setContextMenu(null);
                }}>Clear page</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
