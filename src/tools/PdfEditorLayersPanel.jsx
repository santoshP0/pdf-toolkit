import { memo } from 'react';
import ScrubbySlider from './ScrubbySlider';

const TYPE_ICONS = {
  path: '\u270E', text: 'T', rect: '\u25A1', circle: '\u25CB',
  line: '\u2571', arrow: '\u2192', highlight: '\u2588',
};
const TYPE_LABELS = {
  path: 'Pen stroke', text: 'Text', rect: 'Rectangle', circle: 'Ellipse',
  line: 'Line', arrow: 'Arrow', highlight: 'Highlight',
};

function PdfEditorLayersPanel({
  S,
  showLayers,
  pageAnns,
  selectedIdx, setSelectedIdx,
  setActiveTool,
  setStrokeColor, setStrokeWidth,
  setTextSize, setTextBold, setTextItalic, setSelectedFont,
  setStrokeColorSync, setFillColorSync, setStrokeWidthSync,
  setTextSizeSync, setTextBoldSync, setTextItalicSync, setSelectedFontSync,
  deleteAnn, reorderLayers,
  dragOverLayerIdx, setDragOverLayerIdx,
  setConfirmModal, setAnnsH, currentPage,
  totalAnns, historyIdx, historyLength,
  FONT_OPTIONS, getBounds,
}) {
  if (!showLayers) return null;

  return (
    <>
      {/* Layers list */}
      <div style={{ ...S.panelSection, flex: 1, overflowY: 'auto' }}>
        <div style={{ ...S.panelTitle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>Layers</span>
            {pageAnns.length > 0 && (
              <span style={S.badge}>{pageAnns.length}</span>
            )}
          </div>
          {pageAnns.length > 0 && (
            <button
              onClick={() => {
                setConfirmModal({
                  title: 'Clear All Layers',
                  message: `Remove all ${pageAnns.length} annotation${pageAnns.length > 1 ? 's' : ''} from this page?`,
                  confirmLabel: 'Clear',
                  danger: true,
                  onConfirm: () => {
                    setAnnsH(prev => ({ ...prev, [currentPage]: [] }));
                    setSelectedIdx(null);
                  },
                });
              }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 9, fontFamily: 'var(--font-sans)', fontWeight: 600,
                color: 'var(--text-muted)', padding: '2px 4px', borderRadius: 3,
                transition: 'all 0.1s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'none'; }}
              title="Clear all layers on this page"
            >
              Clear All
            </button>
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
                <div key={ann.id || idx} style={S.layerItem(selectedIdx === idx, dragOverLayerIdx === idx)}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', idx);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                  }}
                  onDragEnter={() => {
                    setDragOverLayerIdx(idx);
                  }}
                  onDragLeave={() => {
                    if (dragOverLayerIdx === idx) setDragOverLayerIdx(null);
                  }}
                  onDragEnd={() => {
                    setDragOverLayerIdx(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverLayerIdx(null);
                    const dragIdx = Number(e.dataTransfer.getData('text/plain'));
                    if (!isNaN(dragIdx)) {
                      reorderLayers(dragIdx, idx);
                    }
                  }}
                  onClick={() => {
                    setSelectedIdx(idx);
                    setActiveTool('select');
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
                  <span style={S.layerIcon}>{ann.note ? '📝' : (TYPE_ICONS[ann.type] || '?')}</span>
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
          {(() => {
            const ann = pageAnns[selectedIdx];
            const b = getBounds(ann);
            const angleDeg = Math.round((ann.rotation || 0) * 180 / Math.PI) || 0;
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontFamily: 'var(--font-sans)', color: 'var(--sketch-text)' }}>
                {/* Type Badge */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Layer Type</span>
                  <span style={{
                    background: 'var(--cat-edit-bg)', color: 'var(--cat-edit)',
                    padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                    textTransform: 'uppercase', letterSpacing: '0.02em'
                  }}>
                    {TYPE_LABELS[ann.type] || ann.type}
                  </span>
                </div>

                {/* Coordinates Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase' }}>Position X</span>
                    <div style={{ background: 'var(--surface-hover)', border: '1px solid var(--border)', padding: '6px 8px', borderRadius: 4, fontSize: 12, fontWeight: 500 }}>
                      {Math.round(b.x)}px
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase' }}>Position Y</span>
                    <div style={{ background: 'var(--surface-hover)', border: '1px solid var(--border)', padding: '6px 8px', borderRadius: 4, fontSize: 12, fontWeight: 500 }}>
                      {Math.round(b.y)}px
                    </div>
                  </div>
                </div>

                {/* Size Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase' }}>Width</span>
                    <div style={{ background: 'var(--surface-hover)', border: '1px solid var(--border)', padding: '6px 8px', borderRadius: 4, fontSize: 12, fontWeight: 500 }}>
                      {Math.round(b.w)}px
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase' }}>Height</span>
                    <div style={{ background: 'var(--surface-hover)', border: '1px solid var(--border)', padding: '6px 8px', borderRadius: 4, fontSize: 12, fontWeight: 500 }}>
                      {Math.round(b.h)}px
                    </div>
                  </div>
                </div>

                {(
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, position: 'relative' }}>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase' }}>
                    {ann.type === 'text' ? 'Text Color' : 'Border/Stroke Color'}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface-hover)', border: '1px solid var(--border)', padding: '6px 8px', borderRadius: 4, fontSize: 12, fontWeight: 500, cursor: 'pointer', position: 'relative' }}>
                    <span style={{ ...S.layerDot(ann.color), border: '1px solid rgba(0,0,0,0.1)' }} />
                    <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>{ann.color}</span>
                    <input
                      type="color"
                      value={(ann.color || '#1a1a1a').startsWith('#') ? ann.color : '#1a1a1a'}
                      onChange={e => {
                        setStrokeColorSync(e.target.value);
                      }}
                      style={{
                        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                        border: 'none', padding: 0, opacity: 0, cursor: 'pointer'
                      }}
                    />
                  </div>
                </div>
                )}


                {/* Fill options for shapes */}
                {['rect', 'circle'].includes(ann.type) && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, position: 'relative' }}>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase' }}>Fill Color</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface-hover)', border: '1px solid var(--border)', padding: '6px 8px', borderRadius: 4, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                        <span style={{
                          width: 10, height: 10, borderRadius: '50%',
                          background: (ann.fillColor || 'transparent') === 'transparent' ? 'linear-gradient(135deg, #fff 45%, #ff3b30 45%, #ff3b30 55%, #fff 55%)' : ann.fillColor,
                          border: '1px solid rgba(0,0,0,0.1)'
                        }} />
                        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {(ann.fillColor || 'transparent') === 'transparent' ? 'NONE' : ann.fillColor}
                        </span>
                        <input
                          type="color"
                          value={(ann.fillColor && ann.fillColor.startsWith('#')) ? ann.fillColor : '#ffffff'}
                          onChange={e => {
                            setFillColorSync(e.target.value);
                          }}
                          style={{
                            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                            border: 'none', padding: 0, opacity: 0, cursor: 'pointer'
                          }}
                        />
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase' }}>Fill Type</span>
                      <button
                        onClick={() => {
                          const currentFill = ann.fillColor || 'transparent';
                          setFillColorSync(currentFill === 'transparent' ? '#ffffff' : 'transparent');
                        }}
                        style={{
                          background: 'var(--surface-hover)', border: '1px solid var(--border)',
                          borderRadius: 4, padding: '6px 8px', fontSize: 11, fontWeight: 600,
                          color: 'var(--sketch-text)', cursor: 'pointer', textAlign: 'center',
                          height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}
                      >
                        {(ann.fillColor || 'transparent') === 'transparent' ? 'Solid Fill' : 'No Fill'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Stroke thickness or size control */}
                {['rect', 'circle', 'line', 'arrow', 'path', 'highlight'].includes(ann.type) && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <ScrubbySlider
                        label={ann.type === 'highlight' ? 'Size' : 'Thickness'}
                        value={ann.strokeWidth || 3}
                        min={1}
                        max={ann.type === 'highlight' ? 40 : 16}
                        onChange={(val) => {
                          setStrokeWidthSync(val);
                        }}
                        style={{ display: 'inline-flex', padding: 0 }}
                        labelStyle={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500 }}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface-hover)', border: '1px solid var(--border)', padding: '4px 8px', borderRadius: 4 }}>
                        <input
                          type="range" min={1} max={ann.type === 'highlight' ? 40 : 16}
                          value={ann.strokeWidth || 3}
                          onChange={e => {
                            setStrokeWidthSync(Number(e.target.value));
                          }}
                          style={{ width: '100%', accentColor: 'var(--cat-edit)', cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: 11, fontWeight: 500, minWidth: 18, textAlign: 'right' }}>
                          px
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase' }}>Rotation</span>
                      <div style={{ background: 'var(--surface-hover)', border: '1px solid var(--border)', padding: '6px 8px', borderRadius: 4, fontSize: 12, fontWeight: 500 }}>
                        {angleDeg}°
                      </div>
                    </div>
                  </div>
                )}

                {/* Text properties */}
                {ann.type === 'text' && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <ScrubbySlider
                          label="Font Size"
                          value={ann.fontSize || 18}
                          min={8}
                          max={72}
                          onChange={(val) => {
                            setTextSizeSync(val);
                          }}
                          style={{ display: 'inline-flex', padding: 0 }}
                          labelStyle={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500 }}
                        />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface-hover)', border: '1px solid var(--border)', padding: '4px 8px', borderRadius: 4 }}>
                          <input
                            type="range" min={8} max={72}
                            value={ann.fontSize || 18}
                            onChange={e => {
                              setTextSizeSync(Number(e.target.value));
                            }}
                            style={{ width: '100%', accentColor: 'var(--cat-edit)', cursor: 'pointer' }}
                          />
                          <span style={{ fontSize: 11, fontWeight: 500, minWidth: 18, textAlign: 'right' }}>
                            px
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase' }}>Rotation</span>
                        <div style={{ background: 'var(--surface-hover)', border: '1px solid var(--border)', padding: '6px 8px', borderRadius: 4, fontSize: 12, fontWeight: 500 }}>
                          {angleDeg}°
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase' }}>Font Family</span>
                      <select
                        value={
                          FONT_OPTIONS.find(f => f.css === ann.fontFamily)?.id || 'auto'
                        }
                        onChange={e => {
                          setSelectedFontSync(e.target.value);
                        }}
                        style={{
                          background: 'var(--surface-hover)', border: '1px solid var(--border)',
                          color: 'var(--sketch-text)', borderRadius: 4, padding: '6px 8px', fontSize: 12,
                          fontFamily: 'var(--font-sans)', outline: 'none', cursor: 'pointer'
                        }}
                      >
                        {FONT_OPTIONS.map(f => {
                          const label = f.id === 'auto'
                            ? `Match PDF (${ann.detectedFont ? FONT_OPTIONS.find(x => x.css === ann.detectedFont)?.label || 'Detect' : 'Detect'})`
                            : f.label;
                          return (
                            <option key={f.id} value={f.id}>
                              {label}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase' }}>Text Style</span>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => {
                            const currentBold = ann.fontWeight >= 700;
                            setTextBoldSync(!currentBold);
                          }}
                          style={{
                            flex: 1, background: (ann.fontWeight >= 700) ? 'var(--cat-edit-bg)' : 'var(--surface-hover)',
                            color: (ann.fontWeight >= 700) ? 'var(--cat-edit)' : 'var(--sketch-text)',
                            border: '1px solid var(--border)', borderRadius: 4, padding: '6px 8px',
                            fontSize: 12, fontWeight: 'bold', cursor: 'pointer'
                          }}
                        >
                          Bold
                        </button>
                        <button
                          onClick={() => {
                            const currentItalic = ann.fontStyle === 'italic';
                            setTextItalicSync(!currentItalic);
                          }}
                          style={{
                            flex: 1, background: (ann.fontStyle === 'italic') ? 'var(--cat-edit-bg)' : 'var(--surface-hover)',
                            color: (ann.fontStyle === 'italic') ? 'var(--cat-edit)' : 'var(--sketch-text)',
                            border: '1px solid var(--border)', borderRadius: 4, padding: '6px 8px',
                            fontSize: 12, fontStyle: 'italic', cursor: 'pointer'
                          }}
                        >
                          Italic
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Stats panel */}
      <div style={{ ...S.panelSection, borderBottom: 'none', marginTop: 'auto', background: 'var(--surface-hover)', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--text-muted)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Active Page Layers</span>
            <span style={{ fontWeight: 600, color: 'var(--sketch-text)' }}>{pageAnns.length}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Total Document Layers</span>
            <span style={{ fontWeight: 600, color: 'var(--sketch-text)' }}>{totalAnns}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Undo History States</span>
            <span style={{ fontWeight: 600, color: 'var(--sketch-text)' }}>{historyIdx + 1} / {historyLength}</span>
          </div>
        </div>
      </div>
    </>
  );
}

export default memo(PdfEditorLayersPanel);
