import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { Blob as NodeBlob } from 'node:buffer';
import { PDFDocument, PDFArray, decodePDFRawStream } from 'pdf-lib';
import { saveAs } from 'file-saver';
import usePdfExport from '../src/tools/pdf-editor/usePdfExport';

vi.mock('file-saver', () => ({ saveAs: vi.fn() }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('exports annotations at the same scale on differently sized PDF pages', async () => {
  vi.stubGlobal('Blob', NodeBlob);
  const source = await PDFDocument.create();
  source.addPage([612, 792]);
  source.addPage([300, 400]);
  const bytes = await source.save();
  const rect = { type: 'rect', x: 30, y: 45, w: 60, h: 75, color: '#000000', strokeWidth: 3 };
  const { result } = renderHook(() => usePdfExport({
    pdfBytesRef: { current: bytes }, file: { name: 'mixed.pdf' },
    annotations: { 1: [rect], 2: [rect] },
  }));
  await act(async () => { await result.current.exportPdf(); });
  expect(saveAs).toHaveBeenCalledOnce();
  const blob = vi.mocked(saveAs).mock.calls[0][0];
  const exported = await PDFDocument.load(new Uint8Array(await blob.arrayBuffer()));
  const operators = exported.getPages().map(page => {
    const contents = page.node.Contents();
    const streams = contents instanceof PDFArray ? contents.asArray() : [contents];
    return streams.map(ref => new TextDecoder().decode(decodePDFRawStream(exported.context.lookup(ref)).decode())).join('\n');
  });
  expect(operators[0]).toContain('1 0 0 1 20 712 cm');
  expect(operators[1]).toContain('1 0 0 1 20 320 cm');
  expect(operators.every(value => value.includes('40 0 l') && value.includes('0 50 l'))).toBe(true);
});
