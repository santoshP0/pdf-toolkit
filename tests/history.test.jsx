import { afterEach, expect, it } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import usePdfHistory from '../src/tools/pdf-editor/usePdfHistory';

afterEach(cleanup);

it('records edits and restores them through undo and redo', async () => {
  const { result } = renderHook(() => usePdfHistory({
    selectedIdxRef: { current: null }, currentPageRef: { current: 1 }, FONT_OPTIONS: [],
  }));
  act(() => { result.current.pushHistory({}); });
  await act(async () => {
    result.current.setAnnsH({ 1: [{ type: 'text', text: 'note', id: 1 }] });
  });
  await waitFor(() => expect(result.current.historyIdx).toBe(1));
  act(() => { result.current.undo(); });
  expect(result.current.annotations).toEqual({});
  act(() => { result.current.redo(); });
  expect(result.current.annotations[1][0].text).toBe('note');
});
