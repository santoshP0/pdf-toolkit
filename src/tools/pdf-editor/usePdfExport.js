import { useState, useCallback } from 'react';
import { PDFDocument, StandardFonts, degrees } from 'pdf-lib';
import { saveAs } from 'file-saver';
import { hexToRgb, parseRichText } from './helpers';

/* ================================================================
   usePdfExport hook
   Owns: processing state
   ================================================================ */
export default function usePdfExport({ pdfBytesRef, pdfBytes, file, annotations, pageSize }) {
  const [processing, setProcessing] = useState(false);

  const exportPdf = useCallback(async () => {
    let bytesToLoad = pdfBytesRef.current || pdfBytes;
    const isDetached = bytesToLoad && (bytesToLoad.byteLength === 0 || bytesToLoad.buffer?.byteLength === 0);
    if ((!bytesToLoad || isDetached) && file) {
      try {
        const arr = await file.arrayBuffer();
        bytesToLoad = new Uint8Array(arr);
        pdfBytesRef.current = bytesToLoad;
      } catch (err) {
        console.error('Failed to reload file arrayBuffer:', err);
      }
    }
    if (!bytesToLoad) return;

    const cleanBytes = new Uint8Array(bytesToLoad);
    setProcessing(true);
    try {
      const doc = await PDFDocument.load(cleanBytes);
      const sansFont = await doc.embedFont(StandardFonts.Helvetica);
      const sansBold = await doc.embedFont(StandardFonts.HelveticaBold);
      const sansItalic = await doc.embedFont(StandardFonts.HelveticaOblique);
      const sansBoldItalic = await doc.embedFont(StandardFonts.HelveticaBoldOblique);
      const serifFont = await doc.embedFont(StandardFonts.TimesRoman);
      const serifBold = await doc.embedFont(StandardFonts.TimesRomanBold);
      const serifItalic = await doc.embedFont(StandardFonts.TimesRomanItalic);
      const serifBoldItalic = await doc.embedFont(StandardFonts.TimesRomanBoldItalic);
      const monoFont = await doc.embedFont(StandardFonts.Courier);
      const monoBold = await doc.embedFont(StandardFonts.CourierBold);
      const monoItalic = await doc.embedFont(StandardFonts.CourierOblique);
      const monoBoldItalic = await doc.embedFont(StandardFonts.CourierBoldOblique);
      const pages = doc.getPages();

      Object.entries(annotations).forEach(([pageNum, anns]) => {
        const page = pages[parseInt(pageNum) - 1];
        if (!page) return;
        const { width, height } = page.getSize();
        const sx = width / pageSize.width;
        const sy = height / pageSize.height;

        anns.forEach(ann => {
          const color = hexToRgb(ann.color);
          const sw = (ann.strokeWidth || 3) * sx;
          const rot = ann.rotation ? degrees(-(ann.rotation * 180) / Math.PI) : undefined;

          if (ann.type === 'text') {
            if (ann.whiteout) {
              const wo = ann.whiteout;
              let woColor = { r: 1, g: 1, b: 1 };
              if (wo.bgColor && wo.bgColor !== '#ffffff') {
                const m = wo.bgColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
                if (m) woColor = hexToRgb(wo.bgColor);
              }
              page.drawRectangle({ x: wo.x * sx, y: height - (wo.y + wo.h) * sy, width: wo.w * sx, height: wo.h * sy, color: woColor, borderWidth: 0 });
            }
            const ff = ann.fontFamily || '';
            const isSerif = /times|georgia|garamond|palatino|serif/i.test(ff) && !/sans/i.test(ff);
            const isMono = /courier|mono/i.test(ff);
            const isBold = ann.fontWeight >= 700;
            const isItalic = ann.fontStyle === 'italic';
            const pickFont = (bold, italic) => {
              if (isMono) return bold && italic ? monoBoldItalic : bold ? monoBold : italic ? monoItalic : monoFont;
              if (isSerif) return bold && italic ? serifBoldItalic : bold ? serifBold : italic ? serifItalic : serifFont;
              return bold && italic ? sansBoldItalic : bold ? sansBold : italic ? sansItalic : sansFont;
            };
            const lines = (ann.text || '').split('\n');
            const lh = ann.fontSize * 1.25;
            lines.forEach((line, li) => {
              if (line.trim()) {
                const segments = parseRichText(line);
                let dx = 0;
                const theta = ann.rotation ? -ann.rotation : 0;
                const cosT = Math.cos(theta), sinT = Math.sin(theta);
                const startX = ann.x * sx;
                const startY = height - (ann.y + li * lh) * sy;
                segments.forEach(seg => {
                  const finalBold = seg.bold || isBold;
                  const finalItalic = seg.italic || isItalic;
                  const segFont = pickFont(finalBold, finalItalic);
                  const drawSize = ann.fontSize * sy;
                  const px = startX + dx * cosT;
                  const py = startY + dx * sinT;
                  page.drawText(seg.text, { x: px, y: py, size: drawSize, font: segFont, color, rotate: rot });
                  dx += segFont.widthOfTextAtSize(seg.text, drawSize);
                });
              }
            });
          } else if (ann.type === 'path') {
            for (let i = 1; i < ann.points.length; i++) {
              page.drawLine({ start: { x: ann.points[i-1].x*sx, y: height-ann.points[i-1].y*sy }, end: { x: ann.points[i].x*sx, y: height-ann.points[i].y*sy }, thickness: sw, color });
            }
          } else if (ann.type === 'highlight') {
            for (let i = 1; i < ann.points.length; i++) {
              page.drawLine({ start: { x: ann.points[i-1].x*sx, y: height-ann.points[i-1].y*sy }, end: { x: ann.points[i].x*sx, y: height-ann.points[i].y*sy }, thickness: sw, color, opacity: 0.35 });
            }
          } else if (ann.type === 'rect') {
            const rx = ann.w >= 0 ? ann.x*sx : (ann.x+ann.w)*sx;
            const ry = ann.h >= 0 ? height-(ann.y+ann.h)*sy : height-ann.y*sy;
            const fillCol = ann.fillColor && ann.fillColor !== 'transparent' ? hexToRgb(ann.fillColor) : undefined;
            page.drawRectangle({ x: rx, y: ry, width: Math.abs(ann.w)*sx, height: Math.abs(ann.h)*sy, borderColor: color, borderWidth: sw, color: fillCol, rotate: rot });
          } else if (ann.type === 'circle') {
            const fillCol = ann.fillColor && ann.fillColor !== 'transparent' ? hexToRgb(ann.fillColor) : undefined;
            page.drawEllipse({ x: (ann.x+ann.w/2)*sx, y: height-(ann.y+ann.h/2)*sy, xScale: Math.abs(ann.w)/2*sx||1, yScale: Math.abs(ann.h)/2*sy||1, borderColor: color, borderWidth: sw, color: fillCol, rotate: rot });
          } else if (ann.type === 'line' || ann.type === 'arrow') {
            page.drawLine({ start: { x: ann.x1*sx, y: height-ann.y1*sy }, end: { x: ann.x2*sx, y: height-ann.y2*sy }, thickness: sw, color });
            if (ann.type === 'arrow') {
              const angle = Math.atan2(ann.y2-ann.y1, ann.x2-ann.x1);
              const hl = 12 + (ann.strokeWidth||3)*2;
              page.drawLine({ start: { x: ann.x2*sx, y: height-ann.y2*sy }, end: { x: (ann.x2-hl*Math.cos(angle-0.4))*sx, y: height-(ann.y2-hl*Math.sin(angle-0.4))*sy }, thickness: sw, color });
              page.drawLine({ start: { x: ann.x2*sx, y: height-ann.y2*sy }, end: { x: (ann.x2-hl*Math.cos(angle+0.4))*sx, y: height-(ann.y2-hl*Math.sin(angle+0.4))*sy }, thickness: sw, color });
            }
          }
        });
      });

      const outBytes = await doc.save();
      const name = file.name.replace(/\.pdf$/i, '') + '_edited.pdf';
      saveAs(new Blob([outBytes], { type: 'application/pdf' }), name);
    } catch (err) {
      alert('Export error: ' + err.message);
    } finally {
      setProcessing(false);
    }
  }, [pdfBytesRef, pdfBytes, file, annotations, pageSize]);

  return { exportPdf, processing };
}
