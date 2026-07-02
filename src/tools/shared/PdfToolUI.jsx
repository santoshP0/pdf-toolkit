import { formatSize } from '../../App';

/* ── Dropzone ── */
export function Dropzone({ dragOver, dropzoneProps, inputRef, onInputChange, icon, label, accept = '.pdf', multi = false }) {
  return (
    <div className={`dropzone${dragOver ? ' dragover' : ''}`} {...dropzoneProps}>
      <div className="dropzone-icon">{icon || '\uD83D\uDCC4'}</div>
      <div className="dropzone-text">
        <strong>{label || 'Drop a PDF file here'}</strong> or click to browse
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multi}
        hidden
        onChange={onInputChange}
      />
    </div>
  );
}

/* ── Single file info row ── */
export function FileInfo({ file, pageCount, onRemove, extra }) {
  return (
    <div className="file-list">
      <div className="file-item">
        <span className="file-name">{file.name}</span>
        <span className="file-size">
          {formatSize(file.size)}
          {pageCount > 0 && <> &middot; {pageCount} pages</>}
          {extra}
        </span>
        <button className="file-remove" onClick={onRemove}>{'\u00D7'}</button>
      </div>
    </div>
  );
}

/* ── Progress bar ── */
export function ProgressBar({ progress, label }) {
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <div className="progress-text">{label || 'Processing...'} {progress}%</div>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

/* ── Action row ── */
export function ActionRow({ children }) {
  return <div className="action-row">{children}</div>;
}
