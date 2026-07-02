import { memo } from 'react';
import { formatSize } from '../App';

function PdfEditorStatusBar({
  S,
  file,
  currentPage, totalPages, setCurrentPage,
  zoom, setZoom,
  showThumbs, setShowThumbs,
  showLayers, setShowLayers,
  totalAnns, processing,
  handleClearWorkspace, exportPdf,
  fitToWidth, setSelectedIdx,
  clamp, ZOOM_MIN, ZOOM_MAX,
}) {
  return (
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

        <button
          onClick={handleClearWorkspace}
          title="Close current file and open a new one"
          style={{
            padding: '5px 14px', borderRadius: 8,
            border: '1.5px solid #3b82f6',
            background: 'rgba(59,130,246,0.08)', color: '#3b82f6',
            fontSize: 10, fontWeight: 700, cursor: 'pointer',
            fontFamily: 'var(--font-hand)',
            letterSpacing: '0.01em',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#3b82f6'; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.08)'; e.currentTarget.style.color = '#3b82f6'; }}
        >open new file</button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
          {totalAnns > 0 ? `${totalAnns} annotation${totalAnns > 1 ? 's' : ''}` : ''}
        </span>
        <button
          disabled={processing || totalAnns === 0}
          onClick={exportPdf}
          title="Export annotated PDF"
          style={{
            padding: '5px 16px', borderRadius: 8,
            border: '1.5px solid #ef4444',
            background: (processing || totalAnns === 0) ? 'rgba(239,68,68,0.04)' : '#ef4444',
            color: (processing || totalAnns === 0) ? '#ef4444' : '#fff',
            fontSize: 10, fontWeight: 700, cursor: (processing || totalAnns === 0) ? 'default' : 'pointer',
            fontFamily: 'var(--font-hand)',
            letterSpacing: '0.01em',
            transition: 'all 0.15s',
            opacity: (processing || totalAnns === 0) ? 0.4 : 1,
            boxShadow: (processing || totalAnns === 0) ? 'none' : '0 2px 8px rgba(239,68,68,0.25)',
          }}
          onMouseEnter={e => { if (!e.currentTarget.disabled) { e.currentTarget.style.background = '#dc2626'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(239,68,68,0.35)'; }}}
          onMouseLeave={e => { if (!e.currentTarget.disabled) { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(239,68,68,0.25)'; }}}
        >
          {processing ? 'exporting...' : 'export pdf'}
        </button>
      </div>
    </div>
  );
}

export default memo(PdfEditorStatusBar);
