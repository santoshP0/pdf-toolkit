import { rgb } from 'pdf-lib';

/* ================================================================
   Constants
   ================================================================ */
export const COLORS = [
  '#1a1a1a', '#ffffff', '#e63946', '#f4a261',
  '#e9c46a', '#2a9d8f', '#457b9d', '#6a4c93',
];

export const FONT_OPTIONS = [
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

export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 4.0;
export const ZOOM_STEP = 0.1;
export const MAX_HISTORY = 50;
export const SNAP_THRESHOLD = 5;

/* ================================================================
   Font detection helpers
   ================================================================ */

/* Detect best CSS font-family from a PDF internal font name */
export function detectFontFamily(fontName) {
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

/* Detect best CSS font-weight from font name */
export function detectFontWeight(fontName, actualFamily) {
  const fn = ((fontName || '') + ' ' + (actualFamily || '')).toLowerCase();
  if (/bold|black|heavy|semibold|medium/i.test(fn)) {
    if (/semibold|medium/i.test(fn)) return 600;
    return 700;
  }
  if (/light|thin|ultralight|extralight/i.test(fn)) {
    if (/thin|ultralight/i.test(fn)) return 200;
    return 300;
  }
  return 400;
}

/* ================================================================
   Pure helper functions
   ================================================================ */

export function hexToRgb(hex) {
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

export function parseRichText(text) {
  const segments = [];
  let currentText = '';
  let isBold = false;
  let isItalic = false;

  let i = 0;
  while (i < text.length) {
    if (text.substring(i, i + 3) === '<b>') {
      if (currentText) {
        segments.push({ text: currentText, bold: isBold, italic: isItalic });
        currentText = '';
      }
      isBold = true;
      i += 3;
    } else if (text.substring(i, i + 4) === '</b>') {
      if (currentText) {
        segments.push({ text: currentText, bold: isBold, italic: isItalic });
        currentText = '';
      }
      isBold = false;
      i += 4;
    } else if (text.substring(i, i + 3) === '<i>') {
      if (currentText) {
        segments.push({ text: currentText, bold: isBold, italic: isItalic });
        currentText = '';
      }
      isItalic = true;
      i += 3;
    } else if (text.substring(i, i + 4) === '</i>') {
      if (currentText) {
        segments.push({ text: currentText, bold: isBold, italic: isItalic });
        currentText = '';
      }
      isItalic = false;
      i += 4;
    } else {
      currentText += text[i];
      i++;
    }
  }
  if (currentText) {
    segments.push({ text: currentText, bold: isBold, italic: isItalic });
  }
  return segments;
}

export function clamp(val, min, max) {
  return Math.min(max, Math.max(min, val));
}

export function uid() {
  return Date.now() + Math.random();
}

export function getBounds(ann) {
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
  if (ann.type === 'image') {
    return { x: ann.x, y: ann.y, w: ann.w, h: ann.h };
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
    const maxLen = Math.max(...lines.map(l => l.replace(/<\/?[bi]>/g, '').length), 1);
    const w = maxLen * ann.fontSize * 0.55;
    const lineH = ann.fontSize * 1.25;
    const h = lines.length * lineH;
    return { x: ann.x, y: ann.y - ann.fontSize, w: Math.max(w, 20), h: Math.max(h, ann.fontSize * 1.3) };
  }
  return { x: 0, y: 0, w: 0, h: 0 };
}

export function getHandleAt(ann, px, py) {
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

export function hitTest(ann, px, py) {
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

export function moveAnn(ann, dx, dy) {
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

export function cloneAnn(ann) {
  const c = { ...ann, id: uid() };
  if (c.points) c.points = c.points.map(p => ({ ...p }));
  if (c.whiteout) c.whiteout = { ...c.whiteout };
  return c;
}
