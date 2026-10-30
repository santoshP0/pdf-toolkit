import { useEffect, useRef, useState } from 'react';
import ScrubbySlider from './ScrubbySlider';
import {
  cleanHtmlToTags,
  richTextToHtml,
  DEFAULT_FONT_CSS,
  NOTE_MAX_WIDTH,
  NOTE_MIN_HEIGHT,
  NOTE_MIN_WIDTH,
} from './pdf-editor/helpers';

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
  beginToolbarInteraction,
  endToolbarInteraction,
  FONT_OPTIONS,
  selectedFont,
  setSelectedFont,
}) {
  const [isBoldActive, setIsBoldActive] = useState(false);
  const [isItalicActive, setIsItalicActive] = useState(false);

  // Store the initial HTML when editingText is first set or changes
  const currentEditKey = editingText?.sessionId
    || `${editingText?.x}-${editingText?.y}-${editingText?.editIdx}`;
  const prevEditKey = useRef('');

  const updateActiveStyles = () => {
    setIsBoldActive(document.queryCommandState('bold'));
    setIsItalicActive(document.queryCommandState('italic'));
  };

  useEffect(() => {
    const handleSelectionChange = () => {
      if (document.activeElement === textInputRef.current) {
        updateActiveStyles();
      }
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [textInputRef]);

  if (!editingText) return null;

  const isPdfText = !!editingText.pdfTextItem;
  const isNote = !!editingText.note;
  const fs = editingText.matchedFontSize || textSize;
  const lineW = isPdfText ? editingText.pdfTextItem.width + 8 : undefined;
  const noteMaxWidth = Math.min(
    NOTE_MAX_WIDTH,
    Math.max(40, pageSize.width - (editingText.x - 6) - 4),
  );
  
  const detectedFontCSS = editingText.detectedFont || editingText.matchedFont || DEFAULT_FONT_CSS;
  const resolvedFontCSS = selectedFont === 'auto'
    ? detectedFontCSS
    : (FONT_OPTIONS.find(f => f.id === selectedFont)?.css || DEFAULT_FONT_CSS);
    
  const floatingBarY = editingText.y - fs - 42;

  const sizeEditor = (element) => {
    if (!element || isPdfText) return;
    const maxWidth = isNote ? noteMaxWidth : pageSize.width - editingText.x - 4;
    const minWidth = isNote ? Math.min(NOTE_MIN_WIDTH, maxWidth) : 60;
    const minHeight = isNote ? Math.max(NOTE_MIN_HEIGHT, fs * 1.25 + 16) : 0;
    element.style.width = 'auto';
    element.style.width = `${Math.max(minWidth, Math.min(element.scrollWidth + (isNote ? 2 : 10), maxWidth))}px`;
    element.style.height = 'auto';
    element.style.height = `${Math.max(minHeight, element.scrollHeight)}px`;
    if (isNote) {
      const preferredTop = editingText.y - fs - 6;
      const maxTop = Math.max(4, pageSize.height - element.offsetHeight - 4);
      element.style.top = `${Math.max(4, Math.min(preferredTop, maxTop))}px`;
    }
  };

  return (
    <>
      <style>{`
        .pdf-editor-contenteditable:empty:before {
          content: attr(placeholder);
          color: var(--sketch-text);
          opacity: 0.5;
          pointer-events: none;
          display: block;
        }
        .pdf-editor-contenteditable.is-note::after {
          content: '';
          position: absolute;
          right: -1px;
          bottom: -1px;
          width: 10px;
          height: 10px;
          background: linear-gradient(135deg, #e0c94a 0 49%, #fffdf0 50% 100%);
          border-left: 1px solid rgba(138, 111, 0, 0.18);
          border-top: 1px solid rgba(138, 111, 0, 0.18);
          pointer-events: none;
        }
      `}</style>

      {/* Floating formatting bar */}
      <div
        className="formatting-bar"
        onPointerDown={beginToolbarInteraction}
        onPointerUp={endToolbarInteraction}
        onPointerCancel={endToolbarInteraction}
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
          onChange={e => {
            const val = e.target.value;
            const resolved = val === 'auto'
              ? (editingText.detectedFont || DEFAULT_FONT_CSS)
              : (FONT_OPTIONS.find(f => f.id === val)?.css || DEFAULT_FONT_CSS);
            setSelectedFont(val);
            setEditingText(prev => ({ ...prev, matchedFont: resolved }));
            if (textInputRef.current) {
              textInputRef.current.style.fontFamily = resolved;
            }
          }}
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
              const resolved = detectedFontCSS;
              const isSerif = /times|georgia|garamond|palatino|serif/i.test(resolved) && !/sans/i.test(resolved);
              const isMono = /courier|consolas|menlo|monaco|mono/i.test(resolved);
              const displayFamily = isMono ? 'Mono' : (isSerif ? 'Serif' : 'Sans');
              label = `Auto (${editingText.detectedFontLabel || displayFamily})`;
            }
            return (
              <option key={f.id} value={f.id}>
                {label}
              </option>
            );
          })}
        </select>

        {/* Font size adjustment with ScrubbySlider */}
        <ScrubbySlider
          label="Size:"
          value={editingText.matchedFontSize || textSize}
          min={8}
          max={72}
          step={1}
          onChange={(next) => {
            setEditingText(prev => ({ ...prev, matchedFontSize: next }));
            setTextSize(next);
            if (textInputRef.current) {
              textInputRef.current.style.fontSize = `${next}px`;
            }
          }}
          style={{ marginRight: 2 }}
        />
        <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', minWidth: 16, color: 'var(--sketch-text)', marginRight: 4 }}>
          px
        </span>

        <div style={{ width: 1, height: 12, background: 'var(--border)' }} />

        {/* Bold Toggle */}
        <button
          onMouseDown={e => {
            e.preventDefault();
            document.execCommand('bold', false, null);
            updateActiveStyles();
          }}
          style={{
            width: 18, height: 18, borderRadius: 3, border: 'none',
            background: isBoldActive ? 'var(--cat-edit-bg)' : 'none',
            color: isBoldActive ? 'var(--cat-edit)' : 'var(--sketch-text)',
            fontWeight: 'bold', fontSize: 10, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
          title="Bold Selection (Ctrl+B)"
        >
          B
        </button>

        {/* Italic Toggle */}
        <button
          onMouseDown={e => {
            e.preventDefault();
            document.execCommand('italic', false, null);
            updateActiveStyles();
          }}
          style={{
            width: 18, height: 18, borderRadius: 3, border: 'none',
            background: isItalicActive ? 'var(--cat-edit-bg)' : 'none',
            color: isItalicActive ? 'var(--cat-edit)' : 'var(--sketch-text)',
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
              if (textInputRef.current) {
                textInputRef.current.style.color = val;
              }
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
            if (textInputRef.current) {
              const html = textInputRef.current.innerHTML;
              commitText(cleanHtmlToTags(html));
            }
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

      <div
        ref={el => {
          textInputRef.current = el;
          if (el) {
            const isNewSession = prevEditKey.current !== currentEditKey;
            if (isNewSession) {
              prevEditKey.current = currentEditKey;
              el.innerHTML = richTextToHtml(editingText.value);
              requestAnimationFrame(() => {
                if (el === textInputRef.current) el.focus({ preventScroll: true });
              });
            }
            if (!isPdfText) {
              sizeEditor(el);
            }

            if (isNewSession && editingText?.clickX != null) {
              // Estimate cursor position from click X coordinate
              const text = editingText.value || '';
              if (text.length > 0) {
                const relX = editingText.clickX - editingText.x;
                const isBold = editingText.matchedBold;
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
                requestAnimationFrame(() => {
                  if (el && el === textInputRef.current) {
                    const range = document.createRange();
                    const sel = window.getSelection();
                    
                    function findTextNode(node) {
                      if (node.nodeType === Node.TEXT_NODE) return node;
                      for (let child of node.childNodes) {
                        const found = findTextNode(child);
                        if (found) return found;
                      }
                      return null;
                    }
                    
                    const textNode = findTextNode(el);
                    if (textNode) {
                      const offset = Math.min(cursorIdx, textNode.length);
                      try {
                        range.setStart(textNode, offset);
                        range.collapse(true);
                        sel.removeAllRanges();
                        sel.addRange(range);
                      } catch (err) {
                        console.error('Failed to set caret selection:', err);
                      }
                    } else {
                      range.selectNodeContents(el);
                      range.collapse(false);
                      sel.removeAllRanges();
                      sel.addRange(range);
                    }
                  }
                });
              }
            }
          }
        }}
        key={`te-${currentEditKey}`}
        autoFocus
        contentEditable={true}
        role="textbox"
        aria-label={isNote ? 'Note text' : 'Annotation text'}
        aria-multiline={!isPdfText}
        onPaste={event => {
          event.preventDefault();
          document.execCommand('insertText', false, event.clipboardData.getData('text/plain'));
        }}
        suppressContentEditableWarning={true}
        onInput={e => {
          updateActiveStyles();
          
          sizeEditor(e.currentTarget);
        }}
        placeholder="Type..."
        className={`pdf-editor-contenteditable${isNote ? ' is-note' : ''}`}
        style={{
          position: 'absolute',
          left: isNote ? editingText.x - 6 : editingText.x,
          top: isNote ? editingText.y - fs - 6 : editingText.y - fs,
          fontSize: fs,
          fontFamily: resolvedFontCSS,
          fontWeight: editingText.matchedBold ? 700 : (editingText.matchedWeight || 400),
          fontStyle: editingText.matchedItalic ? 'italic' : 'normal',
          color: editingText.matchedColor || strokeColor,
          background: isNote ? '#fff9c4' : isPdfText ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.06)',
          border: isNote ? '1px solid #e0c94a' : 'none',
          borderBottom: isNote ? '1px solid #e0c94a' : '2px solid var(--cat-edit)',
          borderRadius: isNote ? 4 : 0,
          padding: isNote ? '5px 7px 11px 5px' : '2px 3px',
          outline: 'none',
          width: isPdfText ? Math.min(lineW, pageSize.width - editingText.x - 4) : undefined,
          minWidth: isPdfText ? undefined : isNote ? Math.min(NOTE_MIN_WIDTH, noteMaxWidth) : 60,
          minHeight: isNote ? Math.max(NOTE_MIN_HEIGHT, fs * 1.25 + 16) : undefined,
          maxWidth: isNote ? noteMaxWidth : pageSize.width - editingText.x - 4,
          boxSizing: 'border-box',
          resize: 'none',
          overflowX: isPdfText ? 'auto' : 'hidden',
          overflowY: 'hidden',
          lineHeight: 1.25, zIndex: 100,
          caretColor: 'var(--cat-edit)',
          whiteSpace: isPdfText ? 'nowrap' : 'pre-wrap',
          wordBreak: isPdfText ? 'normal' : 'break-word',
          height: isPdfText ? Math.round(fs * 1.25 + 8) : undefined,
          boxShadow: isNote
            ? '0 0 0 2px rgba(106,76,147,0.24), 0 4px 10px rgba(0,0,0,0.12)'
            : isPdfText
            ? '0 0 0 1px rgba(106,76,147,0.2), 0 2px 8px rgba(0,0,0,0.08)'
            : 'none',
          pointerEvents: 'auto',
        }}
        onKeyDown={e => {
          e.stopPropagation();
          if (e.key === 'Enter') {
            if (isPdfText) {
              e.preventDefault();
              commitText(cleanHtmlToTags(e.target.innerHTML));
            }
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            setEditingText(null);
            setGuides({ h: [], v: [] });
          }
        }}
        onBlur={e => {
          const html = e.target.innerHTML;
          const cleanVal = cleanHtmlToTags(html);
          setTimeout(() => {
            if (isInteractingWithToolbarRef.current) {
              return;
            }
            if (document.activeElement !== textInputRef.current) {
              commitText(cleanVal);
            }
          }, 150);
        }}
        onPointerDown={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()}
      />
    </>
  );
}
