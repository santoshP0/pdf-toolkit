import { useEffect } from 'react';

export default function PdfEditorTextOverlay({
  editingText,
  setEditingText,
  textInputRef,
  pageSize,
  textSize,
  setTextSize,
  strokeColor,
  setStrokeColor,
  commitText,
  setGuides,
  isInteractingWithToolbarRef,
  handleEditorFormat,
  FONT_OPTIONS,
  selectedFont,
  setSelectedFont,
}) {
  if (!editingText) return null;

  const isPdfText = !!editingText.pdfTextItem;
  const fs = editingText.matchedFontSize || textSize;
  const lineW = isPdfText ? editingText.pdfTextItem.width + 8 : undefined;
  
  // Resolve CSS Font family name
  const resolvedFontCSS = selectedFont === 'auto'
    ? (editingText.matchedFont || '"Times New Roman", serif')
    : (FONT_OPTIONS.find(f => f.id === selectedFont)?.css || '"Times New Roman", serif');
    
  const floatingBarY = editingText.y - fs - 42;

  return (
    <>
      {/* Floating formatting bar */}
      <div
        className="formatting-bar"
        onPointerDown={() => { isInteractingWithToolbarRef.current = true; }}
        onPointerUp={() => { setTimeout(() => { isInteractingWithToolbarRef.current = false; }, 100); }}
        style={{
          position: 'absolute',
          left: editingText.x,
          top: floatingBarY,
          zIndex: 101,
          display: 'flex',
          gap: 5,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          padding: '4px 6px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
          alignItems: 'center',
          pointerEvents: 'auto',
        }}
      >
        {/* Font family */}
        <select
          value={selectedFont}
          onChange={e => setSelectedFont(e.target.value)}
          style={{
            fontSize: 9, padding: '2px 4px',
            border: '1px solid var(--border)', borderRadius: 4,
            background: 'var(--bg2)', color: 'var(--sketch-text)',
            fontFamily: 'var(--font-sans)', cursor: 'pointer',
            width: 72, textOverflow: 'ellipsis',
          }}
        >
          {FONT_OPTIONS.map(f => {
            let label = f.label;
            if (f.id === 'auto') {
              const resolved = editingText.matchedFont || '"Times New Roman", serif';
              const isSerif = /times|georgia|garamond|palatino|serif/i.test(resolved) && !/sans/i.test(resolved);
              const isMono = /courier|mono/i.test(resolved);
              const displayFamily = isMono ? 'Mono' : (isSerif ? 'Serif' : 'Sans');
              label = `Auto (${displayFamily})`;
            }
            return (
              <option key={f.id} value={f.id}>
                {label}
              </option>
            );
          })}
        </select>

        {/* Font size adjustment */}
        <button
          onClick={() => {
            const cur = editingText.matchedFontSize || textSize;
            const next = Math.max(8, cur - 1);
            setEditingText(prev => ({ ...prev, matchedFontSize: next }));
            setTextSize(next);
          }}
          style={{ border: 'none', background: 'none', fontSize: 11, cursor: 'pointer', color: 'var(--sketch-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: 3 }}
          onMouseEnter={e => e.target.style.background = 'var(--bg2)'}
          onMouseLeave={e => e.target.style.background = 'none'}
        >
          A-
        </button>
        <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', minWidth: 16, textAlign: 'center', color: 'var(--sketch-text)' }}>
          {editingText.matchedFontSize || textSize}
        </span>
        <button
          onClick={() => {
            const cur = editingText.matchedFontSize || textSize;
            const next = Math.min(72, cur + 1);
            setEditingText(prev => ({ ...prev, matchedFontSize: next }));
            setTextSize(next);
          }}
          style={{ border: 'none', background: 'none', fontSize: 11, cursor: 'pointer', color: 'var(--sketch-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: 3 }}
          onMouseEnter={e => e.target.style.background = 'var(--bg2)'}
          onMouseLeave={e => e.target.style.background = 'none'}
        >
          A+
        </button>

        <div style={{ width: 1, height: 12, background: 'var(--border)' }} />

        {/* Bold Toggle */}
        <button
          onMouseDown={e => e.preventDefault()}
          onClick={() => {
            const formatted = handleEditorFormat('b');
            if (!formatted) {
              setEditingText(prev => ({ ...prev, matchedBold: !prev.matchedBold }));
            }
          }}
          style={{
            width: 18, height: 18, borderRadius: 3, border: 'none',
            background: editingText.matchedBold ? 'var(--cat-edit-bg)' : 'none',
            color: editingText.matchedBold ? 'var(--cat-edit)' : 'var(--sketch-text)',
            fontWeight: 'bold', fontSize: 10, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
          title="Bold Selection (Ctrl+B)"
        >
          B
        </button>

        {/* Italic Toggle */}
        <button
          onMouseDown={e => e.preventDefault()}
          onClick={() => {
            const formatted = handleEditorFormat('i');
            if (!formatted) {
              setEditingText(prev => ({ ...prev, matchedItalic: !prev.matchedItalic }));
            }
          }}
          style={{
            width: 18, height: 18, borderRadius: 3, border: 'none',
            background: editingText.matchedItalic ? 'var(--cat-edit-bg)' : 'none',
            color: editingText.matchedItalic ? 'var(--cat-edit)' : 'var(--sketch-text)',
            fontStyle: 'italic', fontSize: 10, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
          title="Italic Selection (Ctrl+I)"
        >
          I
        </button>

        <div style={{ width: 1, height: 12, background: 'var(--border)' }} />

        {/* Color indicator / selector */}
        <div style={{
          position: 'relative',
          width: 14, height: 14,
          borderRadius: '50%',
          border: '1px solid var(--border)',
          background: editingText.matchedColor || strokeColor,
          cursor: 'pointer',
        }} title="Text Color">
          <input
            type="color"
            value={editingText.matchedColor || strokeColor}
            onChange={e => {
              const val = e.target.value;
              setEditingText(prev => ({ ...prev, matchedColor: val }));
              setStrokeColor(val);
            }}
            style={{
              position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
              border: 'none', padding: 0, opacity: 0, cursor: 'pointer',
            }}
          />
        </div>

        <div style={{ width: 1, height: 12, background: 'var(--border)' }} />

        {/* Save Button */}
        <button
          onClick={() => {
            commitText();
          }}
          style={{
            border: 'none', background: 'var(--cat-edit)', color: '#fff',
            borderRadius: 3, fontSize: 8, padding: '2px 5px', fontWeight: 600,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2,
          }}
        >
          ✓ Save
        </button>
      </div>

      <textarea
        ref={el => {
          textInputRef.current = el;
          if (el) {
            if (!isPdfText) {
              // Auto-grow height & width immediately
              el.style.height = 'auto';
              el.style.height = el.scrollHeight + 'px';
              el.style.width = 'auto';
              el.style.width = Math.max(60, Math.min(el.scrollWidth + 10, pageSize.width - editingText.x - 4)) + 'px';
            }

            if (editingText?.clickX != null) {
              // Estimate cursor position from click X coordinate
              const text = editingText.value || '';
              if (text.length > 0) {
                const relX = editingText.clickX - editingText.x;
                const isBold = editingText.matchedBold;
                // Measure character widths using a temporary canvas
                const mc = document.createElement('canvas').getContext('2d');
                const wt = isBold ? 700 : 400;
                const st = editingText.matchedItalic ? 'italic ' : '';
                mc.font = `${st}${wt} ${fs}px ${resolvedFontCSS}`;
                let cursorIdx = text.length;
                for (let i = 0; i < text.length; i++) {
                  const w = mc.measureText(text.substring(0, i + 1)).width;
                  const prevW = i > 0 ? mc.measureText(text.substring(0, i)).width : 0;
                  const charMid = prevW + (w - prevW) / 2;
                  if (relX < charMid) {
                    cursorIdx = i;
                    break;
                  }
                }
                // Clear clickX so re-renders don't reset cursor
                editingText.clickX = null;
                // Use requestAnimationFrame to set cursor after React renders
                requestAnimationFrame(() => {
                  if (el && el === textInputRef.current) {
                    el.setSelectionRange(cursorIdx, cursorIdx);
                    // For PDF text with nowrap, scroll textarea to show cursor
                    if (isPdfText) {
                      const cursorPixelX = mc.measureText(text.substring(0, cursorIdx)).width;
                      const visibleW = el.clientWidth;
                      // Center cursor in visible area
                      el.scrollLeft = Math.max(0, cursorPixelX - visibleW / 2);
                    }
                  }
                });
              } else {
                editingText.clickX = null;
              }
            }
          }
        }}
        key={`te-${editingText.x}-${editingText.y}-${editingText.editIdx}`}
        autoFocus
        value={editingText.value || ''}
        onChange={e => {
          const val = e.target.value;
          setEditingText(prev => ({ ...prev, value: val }));
        }}
        placeholder="Type..."
        rows={1}
        style={{
          position: 'absolute',
          left: editingText.x,
          top: editingText.y - fs,
          fontSize: fs,
          fontFamily: resolvedFontCSS,
          fontWeight: editingText.matchedBold ? 700 : 400,
          fontStyle: editingText.matchedItalic ? 'italic' : 'normal',
          color: editingText.matchedColor
            || strokeColor,
          background: isPdfText ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.06)',
          border: 'none',
          borderBottom: '2px solid var(--cat-edit)',
          borderRadius: 0,
          padding: '2px 3px',
          outline: 'none',
          // PDF text: fixed line width, no wrap; New text: auto-grow
          width: isPdfText ? Math.min(lineW, pageSize.width - editingText.x - 4) : undefined,
          minWidth: isPdfText ? undefined : 60,
          maxWidth: pageSize.width - editingText.x - 4,
          resize: 'none',
          overflowX: isPdfText ? 'auto' : 'hidden',
          overflowY: 'hidden',
          lineHeight: 1.25, zIndex: 100,
          caretColor: 'var(--cat-edit)',
          whiteSpace: isPdfText ? 'nowrap' : 'pre-wrap',
          wordBreak: isPdfText ? 'normal' : 'break-word',
          // PDF text: fixed single-line height
          height: isPdfText ? Math.round(fs * 1.25 + 8) : undefined,
          boxShadow: isPdfText
            ? '0 0 0 1px rgba(106,76,147,0.2), 0 2px 8px rgba(0,0,0,0.08)'
            : 'none',
          pointerEvents: 'auto',
        }}
        onInput={e => {
          if (!isPdfText) {
            e.target.style.height = 'auto';
            e.target.style.height = e.target.scrollHeight + 'px';
            e.target.style.width = 'auto';
            e.target.style.width = Math.max(60, Math.min(e.target.scrollWidth + 10, pageSize.width - editingText.x - 4)) + 'px';
          }
        }}
        onKeyDown={e => {
          e.stopPropagation();
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitText(e.target.value); }
          if (e.key === 'Escape') { e.preventDefault(); setEditingText(null); setGuides({ h: [], v: [] }); }
        }}
        onBlur={e => {
          const val = e.target.value;
          setTimeout(() => {
            if (isInteractingWithToolbarRef.current) {
              textInputRef.current?.focus();
              return;
            }
            if (document.activeElement !== textInputRef.current) {
              commitText(val);
            }
          }, 150);
        }}
        onPointerDown={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()}
      />
    </>
  );
}
