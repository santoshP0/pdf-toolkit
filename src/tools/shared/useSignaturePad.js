import { useRef, useState, useCallback } from 'react';

/**
 * Reusable free-hand signature pad backed by a <canvas>.
 *
 * Returns a ref to attach to the canvas, pointer handlers, an `isEmpty`
 * flag, and helpers to clear the pad or export it as a trimmed PNG data URL.
 */
export default function useSignaturePad({ color = '#1a1a2e', lineWidth = 2.5 } = {}) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const last = useRef(null);
  const [isEmpty, setIsEmpty] = useState(true);

  const point = useCallback((e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  }, []);

  const start = useCallback((e) => {
    e.preventDefault();
    drawing.current = true;
    last.current = point(e);
  }, [point]);

  const move = useCallback((e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const p = point(e);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    if (isEmpty) setIsEmpty(false);
  }, [point, color, lineWidth, isEmpty]);

  const end = useCallback(() => { drawing.current = false; }, []);

  const clear = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    setIsEmpty(true);
  }, []);

  /** Export the drawn ink, tightly cropped, as a transparent PNG data URL. */
  const toDataURL = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const { width, height } = canvas;
    const { data } = canvas.getContext('2d').getImageData(0, 0, width, height);
    let minX = width, minY = height, maxX = 0, maxY = 0, found = false;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (data[(y * width + x) * 4 + 3] > 10) {
          found = true;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (!found) return null;
    const pad = 8;
    minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
    maxX = Math.min(width, maxX + pad); maxY = Math.min(height, maxY + pad);
    const w = maxX - minX;
    const h = maxY - minY;
    const crop = document.createElement('canvas');
    crop.width = w;
    crop.height = h;
    crop.getContext('2d').drawImage(canvas, minX, minY, w, h, 0, 0, w, h);
    return crop.toDataURL('image/png');
  }, []);

  const padProps = {
    onPointerDown: start,
    onPointerMove: move,
    onPointerUp: end,
    onPointerLeave: end,
    style: { touchAction: 'none' },
  };

  return { canvasRef, padProps, isEmpty, clear, toDataURL };
}
