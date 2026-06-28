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
  { id: 'merge', title: 'Merge PDF', emoji: '📑', cat: 'organize', desc: 'Combine several PDFs into one — drag to reorder.' },
  { id: 'split', title: 'Split PDF', emoji: '✂️', cat: 'organize', desc: 'Pull out page ranges or single pages.' },
  { id: 'organize', title: 'Organize Pages', emoji: '🗃️', cat: 'organize', desc: 'Reorder, rotate and delete pages visually.' },
  { id: 'img2pdf', title: 'Images → PDF', emoji: '🖼️', cat: 'convert', desc: 'Turn JPG & PNG files into one clean PDF.' },
  { id: 'pdf2img', title: 'PDF → Images', emoji: '🏞️', cat: 'convert', desc: 'Export every page as a PNG or JPG.' },
  { id: 'ocr', title: 'OCR Text', emoji: '🔍', cat: 'convert', desc: 'Pull selectable text out of scanned pages.' },
  { id: 'numbers', title: 'Page Numbers', emoji: '#️⃣', cat: 'edit', desc: 'Stamp page numbers — your position & style.' },
  { id: 'rotate', title: 'Rotate PDF', emoji: '🔄', cat: 'edit', desc: 'Spin all or chosen pages the right way up.' },
  { id: 'compress', title: 'Compress PDF', emoji: '🗜️', cat: 'optimize', desc: 'Re-encode images to shrink the file size.' },
  { id: 'watermark', title: 'Watermark', emoji: '💧', cat: 'security', desc: 'Lay a text watermark over every page.' },
];

const CATEGORIES = ['all', 'organize', 'convert', 'edit', 'optimize', 'security'];
const CARD_COLORS = ['#ffe17a', '#bcd6f4', '#ffcfa8', '#c6e7b6', '#dccef2', '#f8c7d7'];
const CARD_TILTS = [-2, 1.5, -1, 2, -1.5, 1, -2, 1.5, -1, 2];

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
            <span className="logo-text">pdftoolbox</span>
          </div>
          <div className="header-right">
            <div className="privacy-badge">
              <span className="privacy-dot" />
              local toolbox &middot; 100% private
            </div>
            <button className="theme-toggle" onClick={() => setDark(d => !d)}>
              {dark ? '☀️' : '🌙'}
            </button>
          </div>
        </header>
        <div className="workspace">
          <button className="ws-back" onClick={() => setOpenTool(null)}>
            \u2190 back to tools
          </button>
          <div className="ws-header">
            <span className="ws-emoji">{tool.emoji}</span>
            <div className="ws-info">
              <h2>{tool.title}</h2>
              <p>{tool.desc}</p>
            </div>
          </div>
          <ToolComponent />
        </div>
        <footer className="footer">
          runs 100% in your browser &middot; powered by pdf-lib &middot; pdf.js &middot; tesseract.js
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
          <div className="privacy-badge">
            <span className="privacy-dot" />
            local toolbox &middot; 100% private
          </div>
          <button className="theme-toggle" onClick={() => setDark(d => !d)}>
            {dark ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      <section className="hero">
        <div className="hero-accent">&ndash; the whole toolkit &ndash;</div>
        <h1 className="hero-title">everything for your PDFs</h1>
      </section>

      <div className="search-wrap">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input
            className="search-input"
            type="text"
            placeholder="search tools..."
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
            onClick={() => setActiveCat(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="divider">
        <span className="divider-text">all {filtered.length} of them \u2193</span>
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
            return (
              <div
                key={tool.id}
                className="card"
                style={{
                  backgroundColor: CARD_COLORS[idx % CARD_COLORS.length],
                  transform: `rotate(${CARD_TILTS[idx % CARD_TILTS.length]}deg)`,
                }}
                onClick={() => setOpenTool(tool.id)}
              >
                <div className="card-top">
                  <span className="card-emoji">{tool.emoji}</span>
                  <div className="card-meta">
                    <span className="card-number">#{String(idx + 1).padStart(2, '0')}</span>
                    <button
                      className={`card-fav${favorites.includes(tool.id) ? ' active' : ''}`}
                      onClick={(e) => toggleFav(tool.id, e)}
                    >
                      {favorites.includes(tool.id) ? '\u2605' : '\u2606'}
                    </button>
                  </div>
                </div>
                <div className="card-title">{tool.title}</div>
                <div className="card-desc">{tool.desc}</div>
                <div className="card-footer">
                  <span className="card-cat">{tool.cat}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <footer className="footer">
        runs 100% in your browser &middot; powered by pdf-lib &middot; pdf.js &middot; tesseract.js
      </footer>
    </>
  );
}

export { formatSize };
export default App;
