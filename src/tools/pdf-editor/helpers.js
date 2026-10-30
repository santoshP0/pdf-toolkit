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
  { id: 'helvetica',  label: 'Helvetica',       css: '"Helvetica Neue", "Helvetica", "Arial", sans-serif' },
  { id: 'georgia',    label: 'Georgia',         css: '"Georgia", serif' },
  { id: 'garamond',   label: 'Garamond',        css: '"Garamond", "Times New Roman", serif' },
  { id: 'palatino',   label: 'Palatino',        css: '"Palatino Linotype", "Book Antiqua", serif' },
  { id: 'arial',      label: 'Arial',           css: '"Arial", "Helvetica", sans-serif' },
  { id: 'calibri',    label: 'Calibri',         css: '"Calibri", "Carlito", "Arial", sans-serif' },
  { id: 'segoe',      label: 'Segoe UI',        css: '"Segoe UI", "Arial", sans-serif' },
  { id: 'verdana',    label: 'Verdana',         css: '"Verdana", sans-serif' },
  { id: 'tahoma',     label: 'Tahoma',          css: '"Tahoma", "Geneva", sans-serif' },
  { id: 'consolas',   label: 'Consolas',        css: '"Consolas", "Menlo", "Courier New", monospace' },
];

export const DEFAULT_FONT_CSS = '"Helvetica Neue", "Helvetica", "Arial", sans-serif';
export const NOTE_MIN_WIDTH = 36;
export const NOTE_MAX_WIDTH = 260;
export const NOTE_MIN_HEIGHT = 30;
export const NOTE_LAYOUT_VERSION = 2;

export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 4.0;
export const ZOOM_STEP = 0.1;
export const MAX_HISTORY = 50;
export const SNAP_THRESHOLD = 5;

/* ================================================================
   Font detection helpers
   ================================================================ */

const FONT_MATCH_CANDIDATES = [
  {
    label: 'Helvetica', category: 'sans',
    css: '"Helvetica Neue", "Helvetica", "Arial", sans-serif',
    aliases: [/helvetica/, /nimbussans/, /swiss/],
  },
  {
    label: 'Arial', category: 'sans',
    css: '"Arial", "Helvetica", sans-serif',
    aliases: [/arial/, /liberationsans/],
  },
  {
    label: 'Calibri', category: 'sans',
    css: '"Calibri", "Carlito", "Arial", sans-serif',
    aliases: [/calibri/, /carlito/],
  },
  {
    label: 'Aptos', category: 'sans',
    css: '"Aptos", "Segoe UI", "Calibri", "Arial", sans-serif',
    aliases: [/aptos/],
  },
  {
    label: 'Segoe UI', category: 'sans',
    css: '"Segoe UI", "Arial", sans-serif',
    aliases: [/segoeui/, /segoe/],
  },
  {
    label: 'Roboto', category: 'sans',
    css: '"Roboto", "Arial", sans-serif',
    aliases: [/roboto/],
  },
  {
    label: 'Inter', category: 'sans',
    css: '"Inter", "Arial", sans-serif',
    aliases: [/inter/],
  },
  {
    label: 'Open Sans', category: 'sans',
    css: '"Open Sans", "Arial", sans-serif',
    aliases: [/opensans/],
  },
  {
    label: 'Verdana', category: 'sans',
    css: '"Verdana", "Arial", sans-serif',
    aliases: [/verdana/],
  },
  {
    label: 'Tahoma', category: 'sans',
    css: '"Tahoma", "Geneva", "Arial", sans-serif',
    aliases: [/tahoma/, /geneva/],
  },
  {
    label: 'Trebuchet MS', category: 'sans',
    css: '"Trebuchet MS", "Arial", sans-serif',
    aliases: [/trebuchet/],
  },
  {
    label: 'Lato', category: 'sans',
    css: '"Lato", "Arial", sans-serif',
    aliases: [/lato/],
  },
  {
    label: 'Montserrat', category: 'sans',
    css: '"Montserrat", "Arial", sans-serif',
    aliases: [/montserrat/],
  },
  {
    label: 'Poppins', category: 'sans',
    css: '"Poppins", "Arial", sans-serif',
    aliases: [/poppins/],
  },
  {
    label: 'Nunito', category: 'sans',
    css: '"Nunito", "Arial", sans-serif',
    aliases: [/nunito/],
  },
  {
    label: 'Noto Sans', category: 'sans',
    css: '"Noto Sans", "Arial", sans-serif',
    aliases: [/notosans/, /sourcesans/],
  },
  {
    label: 'Times New Roman', category: 'serif',
    css: '"Times New Roman", "Times", serif',
    aliases: [/timesnewroman/, /^times/, /nimbusroman/, /liberationserif/],
  },
  {
    label: 'Georgia', category: 'serif',
    css: '"Georgia", "Times New Roman", serif',
    aliases: [/georgia/],
  },
  {
    label: 'Cambria', category: 'serif',
    css: '"Cambria", "Georgia", "Times New Roman", serif',
    aliases: [/cambria/],
  },
  {
    label: 'Garamond', category: 'serif',
    css: '"Garamond", "EB Garamond", "Times New Roman", serif',
    aliases: [/garamond/],
  },
  {
    label: 'Palatino', category: 'serif',
    css: '"Palatino Linotype", "Palatino", "Book Antiqua", serif',
    aliases: [/palatino/, /bookantiqua/],
  },
  {
    label: 'Baskerville', category: 'serif',
    css: '"Baskerville", "Times New Roman", serif',
    aliases: [/baskerville/],
  },
  {
    label: 'Courier New', category: 'mono',
    css: '"Courier New", "Courier", monospace',
    aliases: [/courier/, /liberationmono/, /nimbusmono/],
  },
  {
    label: 'Consolas', category: 'mono',
    css: '"Consolas", "Menlo", "Courier New", monospace',
    aliases: [/consolas/],
  },
  {
    label: 'Menlo', category: 'mono',
    css: '"Menlo", "Monaco", "Courier New", monospace',
    aliases: [/menlo/, /monaco/],
  },
];

const GENERIC_FONT_NAMES = new Set([
  'serif', 'sansserif', 'monospace', 'cursive', 'fantasy', 'systemui',
]);

/* Strip PDF subset prefixes and PostScript style suffixes before matching. */
export function normalizePdfFontName(value) {
  return String(value || '')
    .replace(/^\/+/, '')
    .replace(/^['"]|['"]$/g, '')
    .replace(/#([0-9a-f]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/^[A-Z]{6}\+/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[,_-]+/g, ' ')
    .replace(/\b(?:bold|semibold|demibold|extrabold|black|heavy|medium|regular|italic|oblique|light|thin)\b/gi, ' ')
    .replace(/\b(?:psmt|ps|mt|std|pro)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function compactFontName(value) {
  return normalizePdfFontName(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function inferFontCategory(fontName, actualFamily) {
  const value = `${normalizePdfFontName(fontName)} ${normalizePdfFontName(actualFamily)}`.toLowerCase();
  if (/mono|courier|consolas|menlo|monaco|fixed/.test(value)) return 'mono';
  if (/sans|arial|helvetica|swiss|calibri|aptos|segoe|roboto|inter|verdana|tahoma|lato|poppins|nunito|montserrat/.test(value)) return 'sans';
  if (/serif|times|georgia|cambria|garamond|palatino|book antiqua|baskerville/.test(value)) return 'serif';
  return null;
}

function quoteCssFamily(value) {
  const safe = Array.from(String(value || ''))
    .map(character => character >= ' ' && character !== String.fromCharCode(127) && character !== '"' && character !== '\\' ? character : ' ')
    .join('')
    .trim();
  const compact = safe.toLowerCase().replace(/[^a-z]/g, '');
  if (GENERIC_FONT_NAMES.has(compact)) {
    return compact === 'sansserif' ? 'sans-serif' : compact === 'systemui' ? 'system-ui' : compact;
  }
  return safe ? `"${safe}"` : '';
}

function getPdfJsLoadedFamily(fontName) {
  const raw = String(fontName || '').trim();
  // PDF.js registers embedded fonts under generated names such as g_d0_f1.
  // Keeping that name first gives the browser the exact face when available.
  return /^g_[a-z0-9_]+$/i.test(raw) ? quoteCssFamily(raw) : '';
}

function metricMatch(options, categoryHint) {
  const {
    context, text, width, fontSize, fontWeight = 400, fontStyle = 'normal', skipMetric = false,
  } = options || {};
  const latinLetters = String(text || '').match(/[a-z]/gi) || [];
  if (skipMetric || !context || latinLetters.length < 3 || !Number.isFinite(width) || width <= 0 || !fontSize) return null;

  const candidates = categoryHint
    ? FONT_MATCH_CANDIDATES.filter(candidate => candidate.category === categoryHint)
    : FONT_MATCH_CANDIDATES;
  const targetAdvance = width / fontSize;
  const results = [];

  for (const candidate of candidates) {
    try {
      context.font = `${fontStyle === 'italic' ? 'italic ' : ''}${fontWeight} 100px ${candidate.css}`;
      const measured = context.measureText(text).width / 100;
      if (!Number.isFinite(measured)) continue;
      const score = Math.abs(measured - targetAdvance) / Math.max(targetAdvance, 0.01);
      results.push({ candidate, score });
    } catch {
      // A malformed font entry should not prevent PDF text extraction.
    }
  }

  results.sort((a, b) => a.score - b.score);
  const best = results[0];
  const runnerUp = results[1];
  if (!best || best.score > 0.18) return null;
  // Missing browser fonts often collapse to identical fallbacks. Decline a
  // metric guess when it cannot meaningfully distinguish the candidates.
  if (runnerUp && Math.abs(runnerUp.score - best.score) < 0.004) return null;
  return best;
}

/**
 * Resolve the closest browser CSS family for a PDF font.
 * Name aliases are preferred; canvas width comparison handles generic or
 * obfuscated names. The generated PDF.js family remains first when present.
 */
export function detectFontMatch(fontName, actualFamily, options = {}) {
  const metadataNames = options.metadataNames || [];
  const compactNames = [fontName, actualFamily, ...metadataNames].map(compactFontName).filter(Boolean);
  const meaningfulNames = compactNames.filter(name => !GENERIC_FONT_NAMES.has(name));
  const categoryHint = inferFontCategory(fontName, actualFamily);

  let candidate = FONT_MATCH_CANDIDATES.find(item =>
    meaningfulNames.some(name => item.aliases.some(alias => alias.test(name)))
  );
  let source = candidate ? 'name' : 'fallback';

  if (!candidate) {
    const measured = metricMatch(options, categoryHint);
    if (measured) {
      candidate = measured.candidate;
      source = 'metrics';
    }
  }

  if (!candidate) {
    candidate = FONT_MATCH_CANDIDATES.find(item => item.category === categoryHint)
      || FONT_MATCH_CANDIDATES[0];
  }

  const loadedFamily = getPdfJsLoadedFamily(options.loadedName || fontName);
  const cssFontFamily = quoteCssFamily(options.cssFontFamily);
  const exactFamily = options.exactCss || cssFontFamily || loadedFamily;
  return {
    css: exactFamily ? `${exactFamily}, ${candidate.css}` : candidate.css,
    label: source === 'metrics' ? `${candidate.label}-like` : candidate.label,
    category: candidate.category,
    source,
  };
}

/* Backwards-compatible shorthand used outside text extraction. */
export function detectFontFamily(fontName, actualFamily = '') {
  return detectFontMatch(fontName, actualFamily).css;
}

/* Detect best CSS font-weight from font name */
export function detectFontWeight(fontName, actualFamily) {
  const fn = ((fontName || '') + ' ' + (actualFamily || '')).toLowerCase();
  if (/bold|black|heavy|semibold|demibold|medium/i.test(fn)) {
    if (/semibold|demibold|medium/i.test(fn)) return 600;
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

// Normalize contentEditable HTML to the compact rich-text format stored by
// the editor. Only bold, italic, and line breaks are persisted.
export function richTextToHtml(text) {
  return String(text || '').split('\n').map(line => parseRichText(line).map(segment => {
    let value = segment.text.replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    if (segment.bold) value = `<b>${value}</b>`;
    if (segment.italic) value = `<i>${value}</i>`;
    return value;
  }).join('')).join('<br>');
}

export function cleanHtmlToTags(html) {
  if (!html || html === '<br>' || html === '<div><br></div>') return '';

  const sanitizedHtml = html
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ');
  const container = document.createElement('div');
  container.innerHTML = sanitizedHtml;
  let result = '';

  const traverse = (node, isBold = false, isItalic = false) => {
    if (node.nodeType === Node.TEXT_NODE) {
      let value = node.nodeValue;
      if (isBold) value = `<b>${value}</b>`;
      if (isItalic) value = `<i>${value}</i>`;
      result += value;
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const tag = node.nodeName.toLowerCase();
    const nodeBold = isBold || tag === 'b' || tag === 'strong'
      || node.style.fontWeight === 'bold' || parseInt(node.style.fontWeight, 10) >= 700;
    const nodeItalic = isItalic || tag === 'i' || tag === 'em' || node.style.fontStyle === 'italic';

    if (tag === 'br') {
      result += '\n';
      return;
    }
    if ((tag === 'div' || tag === 'p') && result && !result.endsWith('\n')) {
      result += '\n';
    }
    for (const child of node.childNodes) traverse(child, nodeBold, nodeItalic);
  };

  for (const child of container.childNodes) traverse(child);

  return result
    .replace(/<\/b>(\s*)<b>/gi, '$1')
    .replace(/<\/i>(\s*)<i>/gi, '$1')
    .replace(/<b><\/b>/gi, '')
    .replace(/<i><\/i>/gi, '');
}

// Insert real line breaks using the same rich-text runs the canvas renderer
// understands. Persisting the wraps keeps the yellow note consistent after
// the contentEditable preview is replaced by canvas/PDF drawing.
export function wrapRichTextToWidth(text, maxWidth, measureText) {
  if (!text || !Number.isFinite(maxWidth) || maxWidth <= 0) return text || '';
  const output = [];

  const serialize = (runs) => runs.map(run => {
    let value = run.text;
    if (run.bold) value = `<b>${value}</b>`;
    if (run.italic) value = `<i>${value}</i>`;
    return value;
  }).join('');

  for (const sourceLine of String(text).split('\n')) {
    const wrappedLines = [];
    let runs = [];
    let lineWidth = 0;

    const flush = () => {
      while (runs.length) {
        const lastRun = runs[runs.length - 1];
        lastRun.text = lastRun.text.replace(/\s+$/g, '');
        if (lastRun.text) break;
        runs.pop();
      }
      wrappedLines.push(serialize(runs));
      runs = [];
      lineWidth = 0;
    };
    const append = (value, style) => {
      if (!value) return;
      const previous = runs[runs.length - 1];
      if (previous && previous.bold === style.bold && previous.italic === style.italic) {
        previous.text += value;
      } else {
        runs.push({ text: value, bold: style.bold, italic: style.italic });
      }
      lineWidth += measureText(value, style);
    };

    for (const segment of parseRichText(sourceLine)) {
      const style = { bold: segment.bold, italic: segment.italic };
      const tokens = segment.text.match(/\s+|\S+/g) || [];
      for (const token of tokens) {
        const isSpace = /^\s+$/.test(token);
        if (isSpace && lineWidth === 0) continue;
        const tokenWidth = measureText(token, style);

        if (!isSpace && lineWidth > 0 && lineWidth + tokenWidth > maxWidth) flush();
        if (tokenWidth <= maxWidth) {
          if (isSpace && lineWidth + tokenWidth > maxWidth) flush();
          else append(token, style);
          continue;
        }

        for (const character of token) {
          const characterWidth = measureText(character, style);
          if (lineWidth > 0 && lineWidth + characterWidth > maxWidth) flush();
          if (!(lineWidth === 0 && /\s/.test(character))) append(character, style);
        }
      }
    }

    if (runs.length || wrappedLines.length === 0) flush();
    output.push(...wrappedLines);
  }

  return output.join('\n');
}

// Older sessions may contain the previous fixed-size sticky-note cards.
// Refit them once on load so short notes immediately hug their text too.
export function compactStoredNoteCards(annotations) {
  const estimateLineWidth = (line, fontSize) => [...line.replace(/<\/?[bi]>/g, '')]
    .reduce((width, character) => {
      if (/\s/.test(character)) return width + fontSize * 0.32;
      if (/[MW@#%]/.test(character)) return width + fontSize * 0.8;
      if (/[ilI.,'|!]/.test(character)) return width + fontSize * 0.3;
      return width + fontSize * 0.55;
    }, 0);

  let changed = false;
  const next = {};
  for (const [page, list] of Object.entries(annotations || {})) {
    next[page] = (list || []).map(annotation => {
      if (!annotation?.note || annotation.type !== 'text' || annotation.noteLayoutVersion >= NOTE_LAYOUT_VERSION) {
        return annotation;
      }
      const fontSize = annotation.fontSize || 16;
      const lines = String(annotation.text || '').split('\n');
      const textWidth = Math.max(0, ...lines.map(line => estimateLineWidth(line, fontSize)));
      const width = Math.min(NOTE_MAX_WIDTH, Math.max(NOTE_MIN_WIDTH, textWidth + 14));
      const height = Math.max(NOTE_MIN_HEIGHT, lines.length * fontSize * 1.25 + 16);
      const noteBg = {
        x: annotation.x - 6,
        y: annotation.y - fontSize - 6,
        w: width,
        h: height,
      };
      changed = true;
      return { ...annotation, noteBg, noteLayoutVersion: NOTE_LAYOUT_VERSION };
    });
  }
  return changed ? next : annotations || {};
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
    // Sticky notes are visually defined by their card, not by the estimated
    // text width. Use the real card for selection, hit-testing, handles,
    // rotation, snapping, and the properties inspector.
    if (ann.noteBg) {
      const x = ann.noteBg.w >= 0 ? ann.noteBg.x : ann.noteBg.x + ann.noteBg.w;
      const y = ann.noteBg.h >= 0 ? ann.noteBg.y : ann.noteBg.y + ann.noteBg.h;
      return { x, y, w: Math.abs(ann.noteBg.w), h: Math.abs(ann.noteBg.h) };
    }
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
    if (m.noteBg) {
      m.noteBg = { ...m.noteBg, x: m.noteBg.x + dx, y: m.noteBg.y + dy };
    }
  }
  return m;
}

export function cloneAnn(ann) {
  const c = { ...ann, id: uid() };
  if (c.points) c.points = c.points.map(p => ({ ...p }));
  if (c.whiteout) c.whiteout = { ...c.whiteout };
  if (c.noteBg) c.noteBg = { ...c.noteBg };
  return c;
}
