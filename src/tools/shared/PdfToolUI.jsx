import { formatSize } from './format';

/* ── Dropzone ── */
export function Dropzone({ dragOver, dropzoneProps, inputRef, onInputChange, icon, label, accept = '.pdf', multi = false }) {
  return (
    <div className={`dropzone${dragOver ? ' dragover' : ''}`} {...dropzoneProps}
      role="button" tabIndex={0} aria-label={label || 'Choose a PDF file'}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          inputRef.current?.click();
        }
      }}>
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
        <button className="file-remove" onClick={onRemove} aria-label={`Remove ${file.name}`}>{'\u00D7'}</button>
      </div>
    </div>
  );
}

/* ── Progress bar ── */
export function ProgressBar({ progress, label }) {
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <div className="progress-text">{label || 'Processing...'} {progress}%</div>
      <div className="progress-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label={label || 'Processing'}>
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

/* ── Action row ── */
export function ActionRow({ children }) {
  return <div className="action-row">{children}</div>;
}
