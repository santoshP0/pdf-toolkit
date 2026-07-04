import { memo } from 'react';
import ScrubbySlider from './ScrubbySlider';

const ToolIcon = ({ id, size = 14, stroke = 'currentColor', sw = 1.8 }) => {
  const p = { xmlns: 'http://www.w3.org/2000/svg', width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke, strokeWidth: sw, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (id) {
    case 'select': return <svg {...p}><path d="M5 3l14 9-7 2-4 7z"/><path d="M12 14l5 5"/></svg>;
    case 'text': return <svg {...p}><path d="M6 4h12"/><path d="M12 4v16"/><path d="M8 20h8"/></svg>;
    case 'draw': return <svg {...p}><path d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5z"/></svg>;
    case 'highlight': return <svg {...p} fill={stroke} fillOpacity={0.25}><rect x="3" y="10" width="18" height="6" rx="1"/><path d="M9 10V6h6v4"/></svg>;
    case 'rect': return <svg {...p}><rect x="3" y="3" width="18" height="18" rx="2"/></svg>;
    case 'circle': return <svg {...p}><circle cx="12" cy="12" r="9"/></svg>;
    case 'line': return <svg {...p}><line x1="5" y1="19" x2="19" y2="5"/></svg>;
    case 'arrow': return <svg {...p}><line x1="5" y1="12" x2="19" y2="12"/><polyline points="13 6 19 12 13 18"/></svg>;
    case 'eraser': return <svg {...p}><path d="M20 20H7L3 16a1 1 0 010-1.4l9.6-9.6a2 2 0 012.8 0l5.2 5.2a2 2 0 010 2.8L15 18.6"/></svg>;
    default: return null;
  }
};

const TOOL_DEFS = [
  { id: 'select',    label: 'Move',      shortcut: 'V', group: 0 },
  { id: 'text',      label: 'Text',      shortcut: 'T', group: 0 },
  { id: 'draw',      label: 'Pen',       shortcut: 'P', group: 1 },
  { id: 'highlight', label: 'Highlight',  shortcut: 'H', group: 1 },
  { id: 'rect',      label: 'Rectangle', shortcut: 'R', group: 2 },
  { id: 'circle',    label: 'Ellipse',   shortcut: 'E', group: 2 },
  { id: 'line',      label: 'Line',      shortcut: 'L', group: 2 },
  { id: 'arrow',     label: 'Arrow',     shortcut: 'A', group: 2 },
  { id: 'eraser',    label: 'Eraser',    shortcut: 'X', group: 3 },
];

export { TOOL_DEFS };

function PdfEditorToolStrip({
  S,
  activeTool, setActiveTool,
  toolStripWidth, setToolStripWidth, toolStripResizing,
  hoveredTool, setHoveredTool,
  strokeColor, setStrokeColorSync,
  fillColor, setFillColorSync,
  strokeWidth, setStrokeWidthSync,
  textSize, setTextSizeSync,
  textBold, setTextBoldSync,
  textItalic, setTextItalicSync,
  selectedFont, setSelectedFontSync,
  selectedIdx, setSelectedIdx,
  editingText, setEditingText,
  pageAnns,
  isInteractingWithToolbarRef,
  FONT_OPTIONS,
}) {
  const isWide = toolStripWidth > 85;

  return (
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
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16 }}><ToolIcon id={t.id} size={16} stroke={activeTool === t.id ? 'var(--cat-edit)' : 'var(--sketch-text)'} /></span>
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

      {/* Color/stroke controls — only for drawing tools */}
      {!['select', 'eraser'].includes(activeTool) && <>
      <div style={{ ...S.toolDivider, width: isWide ? '85%' : 22 }} />

      {/* Border (Stroke) Color picker */}
      <div style={{
        display: 'flex',
        flexDirection: isWide ? 'row' : 'column',
        alignItems: 'center',
        justifyContent: isWide ? 'flex-start' : 'center',
        gap: 6,
        padding: '4px 8px',
        width: '100%',
        boxSizing: 'border-box',
      }}>
        {isWide && <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', width: 42, flexShrink: 0 }}>BORDER</span>}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: isWide ? 'var(--bg2)' : 'transparent',
          padding: isWide ? '3px 6px' : 0,
          borderRadius: 6,
          border: isWide ? '1px solid var(--border)' : 'none',
          cursor: 'pointer',
          position: 'relative',
          boxShadow: isWide ? 'inset 0 1px 2px rgba(0,0,0,0.04)' : 'none',
        }} title="Select Border (Stroke) Color">
          <div style={{
            width: 16, height: 16,
            borderRadius: '50%',
            background: strokeColor,
            border: '1.5px solid var(--border)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            flexShrink: 0,
          }} />
          {isWide && (
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

      {/* Fill Color picker (for shape tools or selected shapes) */}
      {((['rect', 'circle'].includes(activeTool)) || (selectedIdx !== null && pageAnns[selectedIdx] && ['rect', 'circle'].includes(pageAnns[selectedIdx].type))) && (
        <div style={{
          display: 'flex',
          flexDirection: isWide ? 'row' : 'column',
          alignItems: 'center',
          justifyContent: isWide ? 'flex-start' : 'center',
          gap: 6,
          padding: '4px 8px',
          width: '100%',
          boxSizing: 'border-box',
          marginTop: 4,
        }}>
          {isWide && <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', width: 42, flexShrink: 0 }}>FILL</span>}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: isWide ? 'var(--bg2)' : 'transparent',
            padding: isWide ? '3px 6px' : 0,
            borderRadius: 6,
            border: isWide ? '1px solid var(--border)' : 'none',
            cursor: 'pointer',
            position: 'relative',
            boxShadow: isWide ? 'inset 0 1px 2px rgba(0,0,0,0.04)' : 'none',
          }} title="Select Fill Color (Double click to toggle transparent)">
            <div style={{
              width: 16, height: 16,
              borderRadius: '50%',
              background: fillColor === 'transparent' ? 'linear-gradient(135deg, #fff 45%, #ff3b30 45%, #ff3b30 55%, #fff 55%)' : fillColor,
              border: '1.5px solid var(--border)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              flexShrink: 0,
            }} onClick={(e) => {
              if (fillColor !== 'transparent' && e.detail === 2) {
                setFillColorSync('transparent');
              }
            }} />
            {isWide && (
              <span style={{
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
                color: 'var(--sketch-text)',
                textTransform: 'uppercase',
                userSelect: 'none',
                letterSpacing: '0.02em',
              }}>
                {fillColor === 'transparent' ? 'NONE' : fillColor}
              </span>
            )}
            <input
              type="color"
              value={fillColor.startsWith('#') ? fillColor : '#ffffff'}
              onChange={e => {
                setFillColorSync(e.target.value);
              }}
              style={{
                position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                border: 'none', padding: 0, opacity: 0, cursor: 'pointer',
              }}
            />
          </div>
          <button
            onClick={() => setFillColorSync(fillColor === 'transparent' ? '#ffffff' : 'transparent')}
            style={{
              background: 'none', border: '1px solid var(--border)',
              borderRadius: 4, padding: '2px 4px', fontSize: 8, cursor: 'pointer',
              color: 'var(--sketch-text)',
              width: isWide ? 'auto' : 22,
              height: 18,
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
            title={fillColor === 'transparent' ? "Set solid fill" : "Set no fill"}
          >
            {fillColor === 'transparent' ? "Solid" : "None"}
          </button>
        </div>
      )}

      </>}

      {['draw', 'highlight', 'rect', 'circle', 'line', 'arrow'].includes(activeTool) && (
        <>
          <div style={{ ...S.toolDivider, width: isWide ? '85%' : 22 }} />
          <div style={{
            display: 'flex',
            flexDirection: isWide ? 'row' : 'column',
            alignItems: 'center',
            justifyContent: isWide ? 'flex-start' : 'center',
            gap: 4,
            width: '100%',
            padding: '4px 8px',
            boxSizing: 'border-box',
          }}>
            <ScrubbySlider
              label={isWide ? "PEN:" : "P:"}
              value={strokeWidth}
              min={1}
              max={16}
              onChange={(val) => setStrokeWidthSync(val)}
              labelStyle={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', width: isWide ? 42 : 'auto', flexShrink: 0 }}
              style={{ display: 'inline-flex', padding: '2px 0' }}
            />
            {isWide && (
              <input type="range" min={1} max={16} value={strokeWidth}
                onChange={e => setStrokeWidthSync(Number(e.target.value))}
                style={{
                  width: '40%',
                  height: 18,
                  accentColor: 'var(--cat-edit)',
                  cursor: 'pointer',
                }}
                title="Pen Stroke Size"
              />
            )}
          </div>
        </>
      )}

      {activeTool === 'text' && (
        <>
          <div style={{ ...S.toolDivider, width: isWide ? '85%' : 22 }} />
          {/* Text Size */}
          <div style={{
            display: 'flex',
            flexDirection: isWide ? 'row' : 'column',
            alignItems: 'center',
            justifyContent: isWide ? 'flex-start' : 'center',
            gap: 4,
            width: '100%',
            padding: '4px 8px',
            boxSizing: 'border-box',
          }}>
            <ScrubbySlider
              label={isWide ? "SIZE:" : "S:"}
              value={textSize}
              min={8}
              max={72}
              onChange={(val) => {
                if (editingText) {
                  setEditingText(prev => ({ ...prev, matchedFontSize: val }));
                }
                setTextSizeSync(val);
              }}
              labelStyle={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', width: isWide ? 42 : 'auto', flexShrink: 0 }}
              style={{ display: 'inline-flex', padding: '2px 0' }}
            />
            {isWide && (
              <input type="range" min={8} max={72} value={textSize}
                onChange={e => {
                  const val = Number(e.target.value);
                  if (editingText) {
                    setEditingText(prev => ({ ...prev, matchedFontSize: val }));
                  }
                  setTextSizeSync(val);
                }}
                style={{
                  width: '40%',
                  height: 18,
                  accentColor: 'var(--cat-edit)',
                  cursor: 'pointer',
                }}
                title="Font Size"
              />
            )}
          </div>

          {/* Font Family */}
          <div style={{
            display: 'flex',
            flexDirection: isWide ? 'row' : 'column',
            alignItems: 'center',
            justifyContent: isWide ? 'flex-start' : 'center',
            gap: 4,
            padding: '4px 8px',
            width: '100%',
            boxSizing: 'border-box',
            marginTop: 2,
          }}>
            {isWide && <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', width: 42, flexShrink: 0 }}>FONT</span>}
            <select value={selectedFont}
              onChange={e => {
                const val = e.target.value;
                setSelectedFontSync(val);
              }}
              style={{
                flex: isWide ? 1 : undefined,
                width: isWide ? 'auto' : 38,
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
            flexDirection: isWide ? 'row' : 'column',
            gap: 4,
            justifyContent: isWide ? 'flex-start' : 'center',
            alignItems: 'center',
            width: '100%',
            padding: '4px 8px',
            boxSizing: 'border-box',
            marginTop: 2,
          }}>
            {isWide && <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', width: 42, flexShrink: 0 }}>STYLE</span>}
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
  );
}

export default memo(PdfEditorToolStrip);
