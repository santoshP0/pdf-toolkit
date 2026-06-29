import { useEffect, useRef, useState } from 'react';
import ScrubbySlider from './ScrubbySlider';

// Clean HTML to our format (<b>, <i>, newlines)
function cleanHtmlToTags(html) {
  if (!html || html === '<br>' || html === '<div><br></div>') return '';

  // Convert &nbsp; and \u00a0 to normal spaces
  const sanitizedHtml = html
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ');

  const temp = document.createElement('div');
  temp.innerHTML = sanitizedHtml;

  let result = '';

  function traverse(node, isBold = false, isItalic = false) {
    if (node.nodeType === Node.TEXT_NODE) {
      let val = node.nodeValue;
      if (isBold) val = `<b>${val}</b>`;
      if (isItalic) val = `<i>${val}</i>`;
      result += val;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = node.nodeName.toLowerCase();
      
      const nodeBold = isBold || tag === 'b' || tag === 'strong' || node.style.fontWeight === 'bold' || parseInt(node.style.fontWeight, 10) >= 700;
      const nodeItalic = isItalic || tag === 'i' || tag === 'em' || node.style.fontStyle === 'italic';

      if (tag === 'br') {
        result += '\n';
      } else if (tag === 'div' || tag === 'p') {
        if (result && !result.endsWith('\n')) {
          result += '\n';
        }
        for (let child of node.childNodes) {
          traverse(child, nodeBold, nodeItalic);
        }
      } else {
        for (let child of node.childNodes) {
          traverse(child, nodeBold, nodeItalic);
        }
      }
    }
  }

  for (let child of temp.childNodes) {
    traverse(child);
  }

  let finalStr = result
    .replace(/<\/b>(\s*)<b>/gi, '$1')
    .replace(/<\/i>(\s*)<i>/gi, '$1');

  finalStr = finalStr
    .replace(/<b><\/b>/gi, '')
    .replace(/<i><\/i>/gi, '');

  return finalStr;
}

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
  const [isBoldActive, setIsBoldActive] = useState(false);
  const [isItalicActive, setIsItalicActive] = useState(false);

  // Store the initial HTML when editingText is first set or changes
  const initialHTML = useRef(null);
  const currentEditKey = `${editingText?.x}-${editingText?.y}-${editingText?.editIdx}`;
  const prevEditKey = useRef('');
  const shouldSetHTML = useRef(false);

  if (editingText && currentEditKey !== prevEditKey.current) {
    initialHTML.current = (editingText.value || '').replace(/\n/g, '<br />');
    prevEditKey.current = currentEditKey;
    shouldSetHTML.current = true;
  }

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
  const fs = editingText.matchedFontSize || textSize;
  const lineW = isPdfText ? editingText.pdfTextItem.width + 8 : undefined;
  
  const resolvedFontCSS = selectedFont === 'auto'
    ? (editingText.matchedFont || '"Times New Roman", serif')
    : (FONT_OPTIONS.find(f => f.id === selectedFont)?.css || '"Times New Roman", serif');
    
  const floatingBarY = editingText.y - fs - 42;

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
      `}</style>

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
          onChange={e => {
            const val = e.target.value;
            setSelectedFont(val);
            setEditingText(prev => ({ ...prev, matchedFont: val }));
            if (textInputRef.current) {
              const resolved = val === 'auto'
                ? (editingText.matchedFont || '"Times New Roman", serif')
                : (FONT_OPTIONS.find(f => f.id === val)?.css || '"Times New Roman", serif');
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
            if (shouldSetHTML.current) {
              el.innerHTML = initialHTML.current;
              shouldSetHTML.current = false;
            }
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
                editingText.clickX = null;
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
              } else {
                editingText.clickX = null;
              }
            }
          }
        }}
        key={`te-${editingText.x}-${editingText.y}-${editingText.editIdx}`}
        contentEditable={true}
        suppressContentEditableWarning={true}
        onInput={e => {
          updateActiveStyles();
          
          if (!isPdfText) {
            e.target.style.height = 'auto';
            e.target.style.height = e.target.scrollHeight + 'px';
            e.target.style.width = 'auto';
            e.target.style.width = Math.max(60, Math.min(e.target.scrollWidth + 10, pageSize.width - editingText.x - 4)) + 'px';
          }
        }}
        placeholder="Type..."
        className="pdf-editor-contenteditable"
        style={{
          position: 'absolute',
          left: editingText.x,
          top: editingText.y - fs,
          fontSize: fs,
          fontFamily: resolvedFontCSS,
          fontWeight: editingText.matchedBold ? 700 : (editingText.matchedWeight || 400),
          fontStyle: editingText.matchedItalic ? 'italic' : 'normal',
          color: editingText.matchedColor || strokeColor,
          background: isPdfText ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.06)',
          border: 'none',
          borderBottom: '2px solid var(--cat-edit)',
          borderRadius: 0,
          padding: '2px 3px',
          outline: 'none',
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
          height: isPdfText ? Math.round(fs * 1.25 + 8) : undefined,
          boxShadow: isPdfText
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
              textInputRef.current?.focus();
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
