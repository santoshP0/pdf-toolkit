import { useState, useEffect, useCallback } from 'react';
import './App.css';

import MergePdf from './tools/MergePdf';
import SplitPdf from './tools/SplitPdf';
import OrganizePages from './tools/OrganizePages';
import ImagesToPdf from './tools/ImagesToPdf';
import PdfToImages from './tools/PdfToImages';
import OcrText from './tools/OcrText';
import PageNumbers from './tools/PageNumbers';
import RotatePdf from './tools/RotatePdf';
import CompressPdf from './tools/CompressPdf';
import Watermark from './tools/Watermark';

const TOOLS = [
  { id: 'merge', title: 'Merge PDF', icon: '📑', cat: 'organize', desc: 'Combine several PDFs into one — drag to reorder.' },
  { id: 'split', title: 'Split PDF', icon: '✂️', cat: 'organize', desc: 'Pull out page ranges or single pages.' },
  { id: 'organize', title: 'Organize Pages', icon: '🗃️', cat: 'organize', desc: 'Reorder, rotate and delete pages visually.' },
  { id: 'img2pdf', title: 'Images → PDF', icon: '🖼️', cat: 'convert', desc: 'Turn JPG & PNG files into one clean PDF.' },
  { id: 'pdf2img', title: 'PDF → Images', icon: '🏞️', cat: 'convert', desc: 'Export every page as a PNG or JPG.' },
  { id: 'ocr', title: 'OCR Text', icon: '🔍', cat: 'convert', desc: 'Pull selectable text out of scanned pages.' },
  { id: 'numbers', title: 'Page Numbers', icon: '#️⃣', cat: 'edit', desc: 'Stamp page numbers — your position & style.' },
  { id: 'rotate', title: 'Rotate PDF', icon: '🔄', cat: 'edit', desc: 'Spin all or chosen pages the right way up.' },
  { id: 'compress', title: 'Compress PDF', icon: '🗜️', cat: 'optimize', desc: 'Re-encode images to shrink the file size.' },
  { id: 'watermark', title: 'Watermark', icon: '💧', cat: 'security', desc: 'Lay a text watermark over every page.' },
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
};

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function App() {
  const [search, setSearch] = useState('');
  const [activeCat, setActiveCat] = useState('all');
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('pdf-toolkit-dark');
    if (saved !== null) return saved === 'true';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [favorites, setFavorites] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('pdf-toolkit-favs') || '[]');
    } catch { return []; }
  });
  const [openTool, setOpenTool] = useState(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    localStorage.setItem('pdf-toolkit-dark', dark);
  }, [dark]);

  useEffect(() => {
    localStorage.setItem('pdf-toolkit-favs', JSON.stringify(favorites));
  }, [favorites]);

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
    return (
      <>
        <header className="header">
          <div className="header-left">
            <span className="logo-badge">PDF</span>
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
        <div className="main-content">
          <div className="workspace">
            <div className="ws-header">
              <span className="ws-emoji">{tool.icon}</span>
              <div className="ws-info">
                <h2>{tool.title}</h2>
                <p>{tool.desc}</p>
              </div>
            </div>
            <ToolComponent />
          </div>
        </div>
        <footer className="footer">
          runs 100% in your browser · powered by pdf-lib · pdf.js · tesseract.js
        </footer>
      </>
    );
  }

  return (
    <>
      <header className="header">
        <div className="header-left">
          <span className="logo-badge">PDF</span>
          <span className="logo-text">pdftoolbox</span>
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
            {filtered.map((tool, i) => {
              const idx = TOOLS.indexOf(tool);
              const catStyle = CAT_CARD_STYLES[tool.cat] || CAT_CARD_STYLES.organize;
              return (
                <div
                  key={tool.id}
                  className="card"
                  style={{ backgroundColor: catStyle.bg }}
                  onClick={() => setOpenTool(tool.id)}
                >
                  <div className="card-top">
                    <span className="card-emoji" style={{ color: catStyle.text }}>{tool.icon}</span>
                    <div className="card-meta">
                      <span className="card-number" style={{ color: catStyle.text }}>#{String(idx + 1).padStart(2, '0')}</span>
                      <button
                        className={`card-fav${favorites.includes(tool.id) ? ' active' : ''}`}
                        onClick={(e) => toggleFav(tool.id, e)}
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

export { formatSize };
export default App;
