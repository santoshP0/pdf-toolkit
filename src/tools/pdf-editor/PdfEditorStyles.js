/* ================================================================
   PDF Editor Styles
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
    width: w || 140, flexShrink: 0,
    display: 'flex', flexDirection: 'column', alignItems: w > 85 ? 'stretch' : 'center',
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

  /* Search bar (floating over canvas area) */
  searchBar: {
    position: 'absolute', top: 10, right: 16, zIndex: 20,
    display: 'flex', alignItems: 'center', gap: 4,
    padding: '4px 6px', borderRadius: 8,
    background: 'var(--surface)', border: '1px solid var(--border)',
    boxShadow: '0 2px 10px rgba(0,0,0,0.12)',
    fontFamily: 'var(--font-sans)',
  },
  searchInput: {
    width: 160, border: 'none', outline: 'none', background: 'transparent',
    fontSize: 12, color: 'var(--sketch-text)', fontFamily: 'var(--font-sans)',
    padding: '2px 4px',
  },
  searchCount: {
    fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)',
    minWidth: 46, textAlign: 'center', whiteSpace: 'nowrap',
  },
  searchBtn: {
    width: 22, height: 22, display: 'inline-flex', alignItems: 'center',
    justifyContent: 'center', border: 'none', borderRadius: 4, padding: 0,
    background: 'transparent', color: 'var(--sketch-text)', cursor: 'pointer',
    boxShadow: 'none',
  },

  /* Right panel */
  rightPanel: (visible) => ({
    width: visible ? 240 : 0, flexShrink: 0,
    background: 'var(--surface)',
    borderLeft: visible ? '1px solid var(--border)' : 'none',
    display: 'flex', flexDirection: 'column',
    transition: 'width 0.15s ease',
    overflow: 'hidden',
  }),
  panelSection: {
    padding: '14px 14px', borderBottom: '1px solid var(--border)',
  },
  panelTitle: {
    fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 11,
    color: 'var(--text-muted)', textTransform: 'uppercase',
    letterSpacing: '0.06em', marginBottom: 10,
  },
  layerItem: (selected, dragOver) => ({
    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
    borderRadius: 6, cursor: 'grab', fontSize: 12,
    fontFamily: 'var(--font-sans)',
    background: selected ? 'var(--cat-edit-bg)' : dragOver ? 'rgba(107, 33, 168, 0.08)' : 'transparent',
    borderTop: dragOver ? '2px solid var(--cat-edit)' : '2px solid transparent',
    borderBottom: '2px solid transparent',
    color: selected ? 'var(--cat-edit)' : 'var(--sketch-text)',
    transition: 'all 0.12s ease', marginBottom: 3,
    userSelect: 'none',
  }),
  layerIcon: {
    width: 18, height: 18,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 12, fontWeight: 700, flexShrink: 0,
    color: 'var(--sketch-text)',
  },
  layerDot: (c) => ({
    width: 9, height: 9, borderRadius: '50%',
    background: c, border: '1px solid var(--border)', flexShrink: 0,
  }),
  layerName: {
    flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    fontSize: 12,
    fontWeight: 500,
  },
  layerDel: {
    background: 'none', border: 'none', color: 'var(--text-muted)',
    cursor: 'pointer', fontSize: 16, padding: '0 4px', lineHeight: 1,
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

export default S;
