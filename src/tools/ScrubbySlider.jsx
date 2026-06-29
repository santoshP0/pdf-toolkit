import React, { useRef, useEffect, useState } from 'react';

export default function ScrubbySlider({
  label,
  value,
  onChange,
  min = 1,
  max = 100,
  step = 1,
  style = {},
  labelStyle = {}
}) {
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startVal = useRef(0);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging.current) return;
      // Calculate drag distance
      const dx = e.clientX - startX.current;
      // 1 unit change per 4 pixels of drag
      const change = Math.round(dx / 4) * step;
      const newVal = Math.max(min, Math.min(max, startVal.current + change));
      onChange(newVal);
    };

    const handleMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        document.body.style.cursor = 'default';
        document.body.style.userSelect = '';
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [min, max, step, onChange]);

  const handleMouseDown = (e) => {
    e.preventDefault();
    isDragging.current = true;
    startX.current = e.clientX;
    startVal.current = value;
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
  };

  return (
    <div
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        cursor: 'ew-resize',
        userSelect: 'none',
        padding: '2px 4px',
        borderRadius: 4,
        background: hovered ? 'var(--bg2)' : 'transparent',
        transition: 'background 0.1s ease',
        ...style
      }}
      title="Click and drag left/right to adjust value"
    >
      <span
        style={{
          fontSize: 9,
          fontWeight: 600,
          color: hovered ? 'var(--cat-edit)' : 'var(--text-muted)',
          marginRight: 4,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          ...labelStyle
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          fontWeight: 600,
          color: 'var(--sketch-text)',
        }}
      >
        {value}
      </span>
    </div>
  );
}
