import { memo } from 'react';

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
    case 'note': return <svg {...p}><path d="M4 4h16v11l-5 5H4z"/><path d="M20 15h-5v5"/></svg>;
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
  { id: 'note',      label: 'Note',      shortcut: 'N', group: 3 },
];

export { TOOL_DEFS };

function ColorPicker({ label, value, onChange, transparent = false }) {
  const displayValue = transparent ? 'None' : value.toUpperCase();
  return (
    <label className="pdf-editor-option pdf-editor-color-option" title={`${label}: ${displayValue}`}>
      <span className="pdf-editor-option-label">{label}</span>
      <span
        className={`pdf-editor-color-swatch${transparent ? ' is-transparent' : ''}`}
        style={transparent ? undefined : { background: value }}
      />
      <span className="pdf-editor-option-value">{displayValue}</span>
      <input
        className="pdf-editor-native-color"
        type="color"
        value={value.startsWith('#') ? value : '#ffffff'}
        onChange={onChange}
        aria-label={`${label} color`}
      />
    </label>
  );
}

function PdfEditorToolStrip({
  activeTool, setActiveTool,
  strokeColor, setStrokeColorSync,
  fillColor, setFillColorSync,
  strokeWidth, setStrokeWidthSync,
  textSize, setTextSizeSync,
  textBold, setTextBoldSync,
  textItalic, setTextItalicSync,
  selectedFont, setSelectedFontSync,
  setSelectedIdx,
  editingText, setEditingText,
  finishEditingText,
  beginToolbarInteraction,
  endToolbarInteraction,
  FONT_OPTIONS,
}) {
  const hasColor = !['select', 'eraser'].includes(activeTool);
  const hasStroke = ['draw', 'highlight', 'rect', 'circle', 'line', 'arrow'].includes(activeTool);
  const hasFill = ['rect', 'circle'].includes(activeTool);
  const isText = activeTool === 'text';
  const currentTool = TOOL_DEFS.find(tool => tool.id === activeTool);

  const updateTextSize = (value) => {
    if (editingText) setEditingText(prev => ({ ...prev, matchedFontSize: value }));
    setTextSizeSync(value);
  };

  return (
    <>
      <div className="pdf-editor-toolstrip">
        <div className="pdf-editor-tools" role="toolbar" aria-label="PDF editing tools">
        {TOOL_DEFS.map((tool, index) => {
          const startsGroup = index > 0 && tool.group !== TOOL_DEFS[index - 1].group;
          return (
            <div className="pdf-editor-tool-wrap" key={tool.id}>
              {startsGroup && <span className="pdf-editor-tool-separator" aria-hidden="true" />}
              <button
                className={`pdf-editor-tool-button${activeTool === tool.id ? ' is-active' : ''}`}
                onClick={() => {
                  finishEditingText?.();
                  setActiveTool(tool.id);
                  setSelectedIdx(null);
                }}
                title={`${tool.label} (${tool.shortcut})`}
                aria-label={`${tool.label} tool`}
                aria-pressed={activeTool === tool.id}
              >
                <ToolIcon id={tool.id} size={18} stroke="currentColor" />
                <span>{tool.label}</span>
                <kbd>{tool.shortcut}</kbd>
              </button>
            </div>
          );
        })}
        </div>
      </div>

      {hasColor && <div
        className="pdf-editor-context-options"
        aria-label={`${currentTool?.label || 'Tool'} options`}
        onPointerDown={beginToolbarInteraction}
        onPointerUp={endToolbarInteraction}
        onPointerCancel={endToolbarInteraction}
      >
        <span className="pdf-editor-context-title">{currentTool?.label || 'Tool'} options</span>

        <ColorPicker
          label={isText ? 'Text' : activeTool === 'note' ? 'Note' : 'Stroke'}
          value={editingText?.matchedColor || strokeColor}
          onChange={(event) => {
            const value = event.target.value;
            if (editingText) setEditingText(prev => ({ ...prev, matchedColor: value }));
            setStrokeColorSync(value);
          }}
        />

        {hasFill && (
          <>
            <ColorPicker
              label="Fill"
              value={fillColor === 'transparent' ? '#ffffff' : fillColor}
              transparent={fillColor === 'transparent'}
              onChange={(event) => setFillColorSync(event.target.value)}
            />
            <button
              className={`pdf-editor-option-button${fillColor === 'transparent' ? ' is-active' : ''}`}
              onClick={() => setFillColorSync(fillColor === 'transparent' ? '#ffffff' : 'transparent')}
              title={fillColor === 'transparent' ? 'Use a solid fill' : 'Remove fill'}
            >
              {fillColor === 'transparent' ? 'Add fill' : 'No fill'}
            </button>
          </>
        )}

        {hasStroke && (
          <label className="pdf-editor-option pdf-editor-range-option">
            <span className="pdf-editor-option-label">{activeTool === 'highlight' ? 'Size' : 'Width'}</span>
            <input
              type="range"
              min="1"
              max={activeTool === 'highlight' ? '40' : '16'}
              value={strokeWidth}
              onChange={(event) => setStrokeWidthSync(Number(event.target.value))}
            />
            <span className="pdf-editor-option-value">{strokeWidth}px</span>
          </label>
        )}

        {isText && (
          <>
            <label className="pdf-editor-option pdf-editor-select-option">
              <span className="pdf-editor-option-label">Font</span>
              <select value={selectedFont} onChange={(event) => setSelectedFontSync(event.target.value)}>
                {FONT_OPTIONS.map(font => (
                  <option key={font.id} value={font.id}>
                    {font.id === 'auto' && editingText?.detectedFontLabel
                      ? `Auto (${editingText.detectedFontLabel})`
                      : font.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="pdf-editor-option pdf-editor-range-option">
              <span className="pdf-editor-option-label">Size</span>
              <input
                type="range"
                min="8"
                max="72"
                value={editingText?.matchedFontSize || textSize}
                onChange={(event) => updateTextSize(Number(event.target.value))}
              />
              <span className="pdf-editor-option-value">{editingText?.matchedFontSize || textSize}px</span>
            </label>
            <button
              className={`pdf-editor-format-button${(editingText ? editingText.matchedBold : textBold) ? ' is-active' : ''}`}
              onClick={() => {
                const value = !(editingText ? editingText.matchedBold : textBold);
                if (editingText) setEditingText(prev => ({ ...prev, matchedBold: value }));
                setTextBoldSync(value);
              }}
              aria-label="Bold"
              aria-pressed={Boolean(editingText ? editingText.matchedBold : textBold)}
            >B</button>
            <button
              className={`pdf-editor-format-button is-italic${(editingText ? editingText.matchedItalic : textItalic) ? ' is-active' : ''}`}
              onClick={() => {
                const value = !(editingText ? editingText.matchedItalic : textItalic);
                if (editingText) setEditingText(prev => ({ ...prev, matchedItalic: value }));
                setTextItalicSync(value);
              }}
              aria-label="Italic"
              aria-pressed={Boolean(editingText ? editingText.matchedItalic : textItalic)}
            >I</button>
          </>
        )}

      </div>}
    </>
  );
}

export default memo(PdfEditorToolStrip);
