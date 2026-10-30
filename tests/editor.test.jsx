import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, renderHook } from '@testing-library/react';
import { createRef } from 'react';
import PdfEditorTextOverlay from '../src/tools/PdfEditorTextOverlay';
import usePdfKeyboard from '../src/tools/pdf-editor/usePdfKeyboard';
import { cleanHtmlToTags, compactStoredNoteCards, getBounds, richTextToHtml, wrapRichTextToWidth } from '../src/tools/pdf-editor/helpers';
import { isPDFEditorSessionExpired, PDF_EDITOR_SESSION_MAX_AGE } from '../src/tools/PdfEditorDB';
import { storage } from '../src/tools/shared/storage';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('rich text and note persistence', () => {
  it('escapes PDF text and only renders supported formatting', () => {
    const html = richTextToHtml('<img src=x onerror=alert(1)><b>safe & sound</b>\nnext');
    const target = document.createElement('div');
    target.innerHTML = html;
    expect(target.querySelector('img')).toBeNull();
    expect(target.querySelector('b').textContent).toBe('safe & sound');
    expect(target.textContent).toContain('<img src=x onerror=alert(1)>');
  });
  it('preserves formatting and actual line breaks from the editor', () => {
    expect(cleanHtmlToTags('One<div><b>two</b>&nbsp;<i>three</i></div>'))
      .toBe('One\n<b>two</b> <i>three</i>');
  });
  it('wraps rich text without carrying trailing spaces into stored lines', () => {
    expect(wrapRichTextToWidth('<b>hello world</b>', 6, text => text.length))
      .toBe('<b>hello</b>\n<b>world</b>');
  });
  it('shrinks legacy oversized notes once and preserves their full selection bounds', () => {
    const old = { 1: [{ type: 'text', note: true, text: 'ress', x: 40, y: 60, fontSize: 12,
      noteBg: { x: 34, y: 42, w: 150, h: 82 } }] };
    const migrated = compactStoredNoteCards(old);
    expect(migrated[1][0].noteBg.w).toBeLessThan(60);
    expect(migrated[1][0].noteBg.h).toBeLessThan(45);
    expect(getBounds(migrated[1][0])).toEqual(migrated[1][0].noteBg);
    expect(compactStoredNoteCards(migrated)).toBe(migrated);
  });
});

describe('editing focus and keyboard shortcuts', () => {
  it('does not select a tool when an edit session temporarily loses focus', () => {
    const setActiveTool = vi.fn();
    renderHook(() => usePdfKeyboard({ editingText: { sessionId: 1 }, setActiveTool }));
    fireEvent.keyDown(window, { key: 'e' });
    fireEvent.keyDown(window, { key: 'r' });
    expect(setActiveTool).not.toHaveBeenCalled();
  });
  it('restores tool shortcuts after the edit ends', () => {
    const setActiveTool = vi.fn();
    const setSelectedIdx = vi.fn();
    renderHook(() => usePdfKeyboard({ editingText: null, setActiveTool, setSelectedIdx }));
    fireEvent.keyDown(window, { key: 'e' });
    expect(setActiveTool).toHaveBeenCalledWith('circle');
  });
  it('shows a compact yellow textbox and keeps typed DOM text during formatting rerenders', () => {
    Object.defineProperty(document, 'queryCommandState', { configurable: true, value: vi.fn(() => false) });
    const textInputRef = createRef();
    const edit = { sessionId: 1, x: 50, y: 60, value: 'hello', note: true };
    const props = { editingText: edit, textInputRef, pageSize: { width: 600, height: 800 },
      textSize: 16, strokeColor: '#000000', selectedFont: 'auto', FONT_OPTIONS: [],
      isInteractingWithToolbarRef: { current: false }, setEditingText: vi.fn(), setGuides: vi.fn(),
      commitText: vi.fn(), setSelectedFont: vi.fn() };
    const view = render(<PdfEditorTextOverlay {...props} />);
    const editor = view.getByRole('textbox', { name: 'Note text' });
    expect(editor.style.background).toBe('rgb(255, 249, 196)');
    expect(parseFloat(editor.style.minWidth)).toBeLessThan(60);
    editor.textContent = 'typed note';
    view.rerender(<PdfEditorTextOverlay {...props} editingText={{ ...edit, matchedBold: true }} />);
    expect(editor.textContent).toBe('typed note');
  });
});

describe('local session safety', () => {
  it('expires sessions at 30 days and rejects invalid legacy timestamps', () => {
    expect(isPDFEditorSessionExpired(Date.now() - PDF_EDITOR_SESSION_MAX_AGE)).toBe(true);
    expect(isPDFEditorSessionExpired(Date.now())).toBe(false);
    expect(isPDFEditorSessionExpired(undefined)).toBe(true);
  });
  it('keeps the app usable when the browser blocks storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(storage.getItem('test')).toBeNull();
    expect(storage.setItem('test', 'value')).toBe(false);
  });
});
