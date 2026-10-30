import { storage } from './tools/shared/storage';
import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import {
  FilePlus2, Scissors, LayoutGrid, Images, ImageDown,
  ScanText, Hash, RotateCw, PackageOpen, Droplets,
  PenLine, Lock, EyeOff, PenSquare, Tag,
  Crop, FileText, Camera, LayoutTemplate, Contrast,
} from 'lucide-react';
import './App.css';
import { clearExpiredPDFEditorLocalStorage } from './tools/PdfEditorDB';
import ErrorBoundary from './ErrorBoundary';

clearExpiredPDFEditorLocalStorage();

const MergePdf = lazy(() => import('./tools/MergePdf'));
const SplitPdf = lazy(() => import('./tools/SplitPdf'));
const OrganizePages = lazy(() => import('./tools/OrganizePages'));
const ImagesToPdf = lazy(() => import('./tools/ImagesToPdf'));
const PdfToImages = lazy(() => import('./tools/PdfToImages'));
const OcrText = lazy(() => import('./tools/OcrText'));
const PageNumbers = lazy(() => import('./tools/PageNumbers'));
const RotatePdf = lazy(() => import('./tools/RotatePdf'));
const CompressPdf = lazy(() => import('./tools/CompressPdf'));
const Watermark = lazy(() => import('./tools/Watermark'));
const PdfEditor = lazy(() => import('./tools/PdfEditor'));
const Metadata = lazy(() => import('./tools/Metadata'));
const ExtractText = lazy(() => import('./tools/ExtractText'));
const CropPdf = lazy(() => import('./tools/CropPdf'));
const NupPdf = lazy(() => import('./tools/NupPdf'));
const Grayscale = lazy(() => import('./tools/Grayscale'));
const SignPdf = lazy(() => import('./tools/SignPdf'));
const ProtectPdf = lazy(() => import('./tools/ProtectPdf'));
const RedactPdf = lazy(() => import('./tools/RedactPdf'));
const ExtractImages = lazy(() => import('./tools/ExtractImages'));

const TOOLS = [
  { id: 'merge',        title: 'Merge PDF',       Icon: FilePlus2,      cat: 'organize', desc: 'Combine several PDFs into one — drag to reorder.' },
  { id: 'split',        title: 'Split PDF',        Icon: Scissors,       cat: 'organize', desc: 'Pull out page ranges or single pages.' },
  { id: 'organize',     title: 'Organize Pages',   Icon: LayoutGrid,     cat: 'organize', desc: 'Reorder, rotate and delete pages visually.' },
  { id: 'img2pdf',      title: 'Images → PDF',     Icon: Images,         cat: 'convert',  desc: 'Turn JPG & PNG files into one clean PDF.' },
  { id: 'pdf2img',      title: 'PDF → Images',     Icon: ImageDown,      cat: 'convert',  desc: 'Export every page as a PNG or JPG.' },
  { id: 'ocr',          title: 'OCR Text',          Icon: ScanText,       cat: 'convert',  desc: 'AI-powered — reads scanned PDFs & images. Use when the PDF has no selectable text.' },
  { id: 'numbers',      title: 'Page Numbers',      Icon: Hash,           cat: 'edit',     desc: 'Stamp page numbers — your position & style.' },
  { id: 'rotate',       title: 'Rotate PDF',        Icon: RotateCw,       cat: 'edit',     desc: 'Spin all or chosen pages the right way up.' },
  { id: 'compress',     title: 'Compress PDF',      Icon: PackageOpen,    cat: 'optimize', desc: 'Re-encode images to shrink the file size.' },
  { id: 'watermark',    title: 'Watermark',         Icon: Droplets,       cat: 'security', desc: 'Lay a text watermark over every page.' },
  { id: 'sign',         title: 'Sign PDF',          Icon: PenLine,        cat: 'security', desc: 'Draw, type or upload a signature & place it.' },
  { id: 'protect',      title: 'Protect PDF',       Icon: Lock,           cat: 'security', desc: 'Add or remove an AES-256 password.' },
  { id: 'redact',       title: 'Redact PDF',        Icon: EyeOff,         cat: 'security', desc: 'Permanently black out sensitive areas.' },
  { id: 'editor',       title: 'PDF Editor',        Icon: PenSquare,      cat: 'edit',     desc: 'Draw, annotate & add text on any page.' },
  { id: 'metadata',     title: 'Edit Metadata',     Icon: Tag,            cat: 'edit',     desc: 'Set title, author, keywords & more.' },
  { id: 'crop',         title: 'Crop PDF',          Icon: Crop,           cat: 'edit',     desc: 'Trim page margins with a live preview.' },
  { id: 'extracttext',  title: 'Extract Text',      Icon: FileText,       cat: 'convert',  desc: "Instantly copies the text layer from digital PDFs. Won't work on scanned or image-only PDFs." },
  { id: 'extractimages',title: 'Extract Images',    Icon: Camera,         cat: 'convert',  desc: 'Save embedded pictures as PNG files.' },
  { id: 'nup',          title: 'Combine Pages',     Icon: LayoutTemplate, cat: 'organize', desc: 'Fit 2–16 pages onto each printed sheet.' },
  { id: 'grayscale',    title: 'Grayscale',         Icon: Contrast,       cat: 'optimize', desc: 'Convert pages to grayscale to save ink.' },
];

const CATEGORIES = ['all', 'organize', 'convert', 'edit', 'optimize', 'security'];

const CAT_CARD_STYLES = {
  organize: { bg: 'var(--cat-organize-bg)', text: 'var(--cat-organize)' },
  convert:  { bg: 'var(--cat-convert-bg)',  text: 'var(--cat-convert)' },
  edit:     { bg: 'var(--cat-edit-bg)',     text: 'var(--cat-edit)' },
  optimize: { bg: 'var(--cat-optimize-bg)', text: 'var(--cat-optimize)' },
  security: { bg: 'var(--cat-security-bg)', text: 'var(--cat-security)' },
};

const TOOL_COMPONENTS = {
  merge: MergePdf,
  split: SplitPdf,
  organize: OrganizePages,
  img2pdf: ImagesToPdf,
  pdf2img: PdfToImages,
  ocr: OcrText,
  numbers: PageNumbers,
  rotate: RotatePdf,
  compress: CompressPdf,
  watermark: Watermark,
  sign: SignPdf,
  protect: ProtectPdf,
  redact: RedactPdf,
  extractimages: ExtractImages,
  editor: PdfEditor,
  metadata: Metadata,
  crop: CropPdf,
  extracttext: ExtractText,
  nup: NupPdf,
  grayscale: Grayscale,
};

function Splash({ onDone }) {
  const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  useEffect(() => {
    const t = setTimeout(onDone, reduce ? 500 : 2300);
    return () => clearTimeout(t);
  }, [onDone, reduce]);
  return (
    <div className={`splash${reduce ? ' splash-reduced' : ''}`} role="status" aria-label="Quill">
      <div className="splash-stage">
        <span className="splash-word">Quill</span>
        <svg className="splash-writing" viewBox="0 0 280 105" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="feather-vane" x1="25" y1="86" x2="77" y2="13" gradientUnits="userSpaceOnUse">
              <stop stopColor="#8c5735" />
              <stop offset="0.42" stopColor="#d8b078" />
              <stop offset="0.72" stopColor="#f2dfbd" />
              <stop offset="1" stopColor="#fff9e8" />
            </linearGradient>
            <linearGradient id="feather-shadow" x1="18" y1="92" x2="70" y2="22" gradientUnits="userSpaceOnUse">
              <stop stopColor="#49301f" />
              <stop offset="1" stopColor="#9a6741" />
            </linearGradient>
          </defs>
          <path
            className="splash-ink-trail"
            d="M30 82 C82 75 125 88 176 79 C204 74 226 78 246 79"
            pathLength="1"
          />
          <g transform={reduce ? 'translate(246 79)' : 'translate(30 82)'}>
            {!reduce && (
              <animateMotion
                path="M0 0 C52 -7 95 6 146 -3 C174 -8 196 -4 216 -3 C223 -4 228 -9 231 -16"
                begin="0.12s"
                dur="1.35s"
                calcMode="spline"
                keyTimes="0;1"
                keySplines="0.22 0.72 0.24 1"
                fill="freeze"
                additive="sum"
              />
            )}
            <g className="splash-feather-tilt">
              {!reduce && (
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  values="-5 0 0;2 0 0;-3 0 0;1 0 0;-6 0 0"
                  keyTimes="0;0.25;0.5;0.75;1"
                  begin="0.12s"
                  dur="1.35s"
                  fill="freeze"
                />
              )}
              <g transform="scale(.62) translate(-14 -109)">
                <path className="splash-feather-shadow" d="M22 92 C30 59 46 23 75 8 C82 40 65 76 28 94 Z" fill="currentColor" opacity=".12" />
                <path d="M22 91 C28 62 46 23 75 8 C80 34 69 61 48 77 C40 83 31 88 22 91 Z" fill="url(#feather-vane)" stroke="url(#feather-shadow)" strokeWidth="1.6" strokeLinejoin="round" />
                <path d="M25 89 C42 69 57 43 74 11" stroke="#5c3b27" strokeWidth="2.4" strokeLinecap="round" />
                <path d="M29 85 C22 95 17 103 14 109" stroke="#5c3b27" strokeWidth="3" strokeLinecap="round" />
                <path d="M15 109 L12 111 L16 104 Z" fill="#26201b" />
                <g className="splash-feather-barbs" stroke="#7a4d30" strokeWidth="1.15" strokeLinecap="round" opacity=".72">
                  <path d="M33 79 L23 75"/><path d="M38 71 L25 66"/><path d="M43 62 L29 56"/><path d="M48 53 L34 45"/><path d="M54 43 L41 34"/><path d="M60 32 L50 24"/>
                  <path d="M36 76 L52 73"/><path d="M42 67 L61 61"/><path d="M47 58 L67 49"/><path d="M52 48 L72 37"/><path d="M58 37 L75 25"/>
                </g>
                <path d="M35 70 L29 67" stroke="#f7e7c8" strokeWidth="2" strokeLinecap="round" opacity=".8" />
              </g>
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
}

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCat, setActiveCat] = useState('all');
  const [dark, setDark] = useState(() => {
    const saved = storage.getItem('pdf-toolkit-dark');
    if (saved !== null) return saved === 'true';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [favorites, setFavorites] = useState(() => {
    try {
      const saved = JSON.parse(storage.getItem('pdf-toolkit-favs') || '[]');
      return Array.isArray(saved) ? saved.filter(id => TOOLS.some(tool => tool.id === id)) : [];
    } catch { return []; }
  });
  const [openTool, setOpenTool] = useState(() => {
    const active = storage.getItem('pdf-toolkit-active-tool');
    if (active && TOOL_COMPONENTS[active]) return active;
    if (storage.getItem('pdf_editor_current_page')) return 'editor';
    return null;
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    storage.setItem('pdf-toolkit-dark', dark);
  }, [dark]);

  useEffect(() => {
    storage.setItem('pdf-toolkit-favs', JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    if (openTool) {
      storage.setItem('pdf-toolkit-active-tool', openTool);
    } else {
      storage.removeItem('pdf-toolkit-active-tool');
    }
  }, [openTool]);

  const toggleFav = useCallback((id, e) => {
    e.stopPropagation();
    setFavorites(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]);
  }, []);

  const filtered = TOOLS.filter(t => {
    const matchCat = activeCat === 'all' || t.cat === activeCat;
    const matchSearch = !search || t.title.toLowerCase().includes(search.toLowerCase()) || t.desc.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  if (openTool) {
    const tool = TOOLS.find(t => t.id === openTool);
    const ToolComponent = TOOL_COMPONENTS[openTool];
    const catStyle = CAT_CARD_STYLES[tool?.cat] || CAT_CARD_STYLES.organize;
    return (
      <>
        {showSplash && <Splash onDone={() => setShowSplash(false)} />}
        <header className="header">
          <div className="header-left">
            <svg className="logo-mark" width="26" height="26" viewBox="0 0 64 64" fill="none" aria-hidden="true">
              <path d="M17 47 L45 18" stroke="#fde047" strokeWidth="11" strokeLinecap="round" opacity="0.9"/>
              <path d="M48 12 C 57 24, 49 41, 23 47 C 30 33, 33 21, 48 12 Z" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinejoin="round"/>
              <path d="M48 12 Q 33 29 18 52" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"/>
              <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M43 18 L49 17"/><path d="M38 25 L45 25"/><path d="M33 32 L41 33"/><path d="M28 39 L36 41"/>
              </g>
              <path d="M23 47 L18 52 L26 49 Z" fill="currentColor"/>
            </svg>
            <button className="ws-back" onClick={() => setOpenTool(null)}>
              ← all tools
            </button>
            <span style={{ color: 'var(--sketch-text)', opacity: 0.3, fontSize: 18, lineHeight: 1 }}>|</span>
            <span style={{
              fontSize: 15, fontWeight: 700,
              color: 'var(--sketch-text)',
              fontFamily: "var(--font-hand)",
            }}>
              {tool.title.toLowerCase()}
            </span>
          </div>
          <div className="header-right">
            <span className="privacy-dot" />
            <span className="privacy-badge">local toolbox · 100% private</span>
            <button className="theme-toggle" onClick={() => setDark(d => !d)}>
              <span style={{ fontSize: 14, lineHeight: 1 }}>{dark ? '☀️' : '🌙'}</span>
            </button>
          </div>
        </header>
        <ErrorBoundary key={openTool} onReset={() => setOpenTool(null)}>
        <Suspense fallback={
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 12 }}>
            <style dangerouslySetInnerHTML={{ __html: `
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}} />
            <div style={{
              width: 32, height: 32,
              border: '3px solid var(--border)',
              borderTopColor: 'var(--cat-edit)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite'
            }} />
            <span style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--text-muted)', fontWeight: 500 }}>
              Loading {tool.title}...
            </span>
          </div>
        }>
          {openTool === 'editor' ? (
            <ToolComponent onBack={() => setOpenTool(null)} tool={tool} />
          ) : openTool === 'extracttext' ? (
            <div className="main-content">
              <div className="workspace">
                <div className="ws-header">
                  <div className="ws-emoji" style={{ color: catStyle?.text || 'var(--cat-convert)', display: 'flex', alignItems: 'center' }}>
                    <tool.Icon size={36} strokeWidth={1.8} />
                  </div>
                  <div className="ws-info">
                    <h2>{tool.title}</h2>
                    <p>{tool.desc}</p>
                  </div>
                </div>
                <ToolComponent onBack={() => setOpenTool(null)} onSwitchToOcr={() => setOpenTool('ocr')} />
              </div>
            </div>
          ) : openTool === 'ocr' ? (
            <div className="main-content">
              <div className="workspace">
                <div className="ws-header">
                  <div className="ws-emoji" style={{ color: catStyle?.text || 'var(--cat-convert)', display: 'flex', alignItems: 'center' }}>
                    <tool.Icon size={36} strokeWidth={1.8} />
                  </div>
                  <div className="ws-info">
                    <h2>{tool.title}</h2>
                    <p>{tool.desc}</p>
                  </div>
                </div>
                <ToolComponent onBack={() => setOpenTool(null)} onSwitchToExtract={() => setOpenTool('extracttext')} />
              </div>
            </div>
          ) : (
            <div className="main-content">
              <div className="workspace">
                <div className="ws-header">
                  <div className="ws-emoji" style={{ color: catStyle?.text || 'var(--cat-convert)', display: 'flex', alignItems: 'center' }}>
                    <tool.Icon size={36} strokeWidth={1.8} />
                  </div>
                  <div className="ws-info">
                    <h2>{tool.title}</h2>
                    <p>{tool.desc}</p>
                  </div>
                </div>
                <ToolComponent onBack={() => setOpenTool(null)} />
              </div>
            </div>
          )}
        </Suspense>
        </ErrorBoundary>
        <footer className="footer">
          runs 100% in your browser · powered by pdf-lib · pdf.js · tesseract.js
        </footer>
      </>
    );
  }

  return (
    <>
      {showSplash && <Splash onDone={() => setShowSplash(false)} />}
      <header className="header">
        <div className="header-left">
          <svg className="logo-mark" width="30" height="30" viewBox="0 0 64 64" fill="none" aria-hidden="true">
            <path d="M17 47 L45 18" stroke="#fde047" strokeWidth="11" strokeLinecap="round" opacity="0.9"/>
            <path d="M48 12 C 57 24, 49 41, 23 47 C 30 33, 33 21, 48 12 Z" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinejoin="round"/>
            <path d="M48 12 Q 33 29 18 52" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"/>
            <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M43 18 L49 17"/><path d="M38 25 L45 25"/><path d="M33 32 L41 33"/><path d="M28 39 L36 41"/>
            </g>
            <path d="M23 47 L18 52 L26 49 Z" fill="currentColor"/>
          </svg>
          <span className="logo-text">Quill</span>
        </div>
        <div className="header-right">
          <span className="privacy-dot" />
          <span className="privacy-badge">local toolbox · 100% private</span>
          <button className="theme-toggle" onClick={() => setDark(d => !d)}>
            <span style={{ fontSize: 14, lineHeight: 1 }}>{dark ? '☀️' : '🌙'}</span>
          </button>
        </div>
      </header>

      <div className="main-content">
        <section className="hero">
          <div className="hero-accent">— the whole toolkit —</div>
          <h1 className="hero-title">everything for your PDFs</h1>
        </section>

        <div className="search-wrap">
          <div className="search-box">
            <span className="search-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="22" y2="22"/>
              </svg>
            </span>
            <input
              className="search-input"
              type="text"
              placeholder="search the toolbox..."
              aria-label="Search PDF tools"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="categories">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              className={`cat-pill${activeCat === cat ? ' active' : ''}`}
              aria-pressed={activeCat === cat}
              onClick={() => { setActiveCat(cat); setSearch(''); }}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="divider">
          <span className="divider-text">
            {search
              ? `search matches (${filtered.length}) ↓`
              : activeCat === 'all'
                ? `all ${filtered.length} of them ↓`
                : `${activeCat} tools (${filtered.length}) ↓`
            }
          </span>
          <span className="divider-line" />
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-emoji">🔍</div>
            <div className="empty-title">No tools found</div>
            <div className="empty-sub">Try a different search or category</div>
          </div>
        ) : (
          <div className="grid">
            {filtered.map((tool) => {
              const idx = TOOLS.indexOf(tool);
              const catStyle = CAT_CARD_STYLES[tool.cat] || CAT_CARD_STYLES.organize;
              return (
                <div
                  key={tool.id}
                  className="card"
                  style={{ backgroundColor: catStyle.bg }}
                  onClick={() => setOpenTool(tool.id)}
                  role="button"
                  tabIndex={0}
                  aria-label={`Open ${tool.title}`}
                  onKeyDown={event => {
                    if (event.target !== event.currentTarget) return;
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setOpenTool(tool.id);
                    }
                  }}
                >
                  <div className="card-top">
                    <span className="card-emoji" style={{ color: catStyle.text, display: 'flex', alignItems: 'center' }}>
                      <tool.Icon size={22} strokeWidth={2} />
                    </span>
                    <div className="card-meta">
                      <span className="card-number" style={{ color: catStyle.text }}>#{String(idx + 1).padStart(2, '0')}</span>
                      <button
                        className={`card-fav${favorites.includes(tool.id) ? ' active' : ''}`}
                        onClick={(e) => toggleFav(tool.id, e)}
                        aria-label={`${favorites.includes(tool.id) ? 'Remove' : 'Add'} ${tool.title} ${favorites.includes(tool.id) ? 'from' : 'to'} favorites`}
                        aria-pressed={favorites.includes(tool.id)}
                      >
                        ★
                      </button>
                    </div>
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div className="card-title">{tool.title}</div>
                      <div className="card-desc">{tool.desc}</div>
                    </div>
                    <div className="card-footer">
                      <span className="card-cat" style={{ color: catStyle.text }}>{tool.cat}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <footer className="footer">
        runs 100% in your browser · powered by pdf-lib · pdf.js · tesseract.js
      </footer>
    </>
  );
}

export default App;
