import { memo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FilePlus2,
  Layers3,
  Maximize2,
  Minus,
  PanelLeft,
  Plus,
  Redo2,
  Search,
  Undo2,
} from 'lucide-react';
import { formatSize } from './shared/format';

function PdfEditorStatusBar({
  file,
  currentPage, totalPages, setCurrentPage,
  zoom, setZoom,
  showThumbs, setShowThumbs,
  showLayers, setShowLayers,
  totalAnns, processing, hasActiveEdit = false,
  handleClearWorkspace, exportPdf,
  fitToWidth, setSelectedIdx,
  clamp, ZOOM_MIN, ZOOM_MAX,
  undo, redo, canUndo = false, canRedo = false,
  setSearchOpen,
}) {
  const hasFileSize = Number.isFinite(file?.size) && file.size >= 0;
  const exportDisabled = processing || (totalAnns === 0 && !hasActiveEdit);

  const goToPreviousPage = () => {
    setCurrentPage(page => Math.max(1, page - 1));
    setSelectedIdx(null);
  };

  const goToNextPage = () => {
    setCurrentPage(page => Math.min(totalPages, page + 1));
    setSelectedIdx(null);
  };

  return (
    <>
    <header className="pdf-editor-command-bar" aria-label="PDF editor controls">
      <div className="pdf-editor-command-file">
        <div className="pdf-editor-command-file-copy">
          <span className="pdf-editor-command-filename" title={file?.name || 'PDF document'}>
            {file?.name || 'PDF document'}
          </span>
          {hasFileSize && (
            <span className="pdf-editor-command-filesize">{formatSize(file.size)}</span>
          )}
        </div>

        <div className="pdf-editor-command-history" role="group" aria-label="Editing history and search">
          <button type="button" className="pdf-editor-command-icon-button" onClick={undo}
            disabled={!canUndo || !undo} aria-label="Undo" title="Undo (Ctrl+Z)">
            <Undo2 size={17} aria-hidden="true" />
          </button>
          <button type="button" className="pdf-editor-command-icon-button" onClick={redo}
            disabled={!canRedo || !redo} aria-label="Redo" title="Redo (Ctrl+Shift+Z)">
            <Redo2 size={17} aria-hidden="true" />
          </button>
          <button type="button" className="pdf-editor-command-icon-button"
            onClick={() => setSearchOpen?.(true)} disabled={!setSearchOpen}
            aria-label="Search document" title="Search document (Ctrl+F)">
            <Search size={17} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="pdf-editor-command-actions">
        <div className="pdf-editor-command-panels" role="group" aria-label="Editor panels">
          <button type="button" className={`pdf-editor-command-toggle${showThumbs ? ' is-active' : ''}`}
            onClick={() => setShowThumbs(value => !value)} aria-label="Toggle page thumbnails"
            aria-pressed={showThumbs} title="Toggle page thumbnails (Ctrl+L)">
            <PanelLeft size={16} aria-hidden="true" /><span>Pages</span>
          </button>
          <button type="button" className={`pdf-editor-command-toggle${showLayers ? ' is-active' : ''}`}
            onClick={() => setShowLayers(value => !value)} aria-label="Toggle layers panel"
            aria-pressed={showLayers} title="Toggle layers panel">
            <Layers3 size={16} aria-hidden="true" /><span>Layers</span>
          </button>
        </div>

        <button type="button" className="pdf-editor-command-new-button"
          onClick={handleClearWorkspace} title="Close this file and open another PDF">
          <FilePlus2 size={16} aria-hidden="true" /><span>Open new</span>
        </button>

        <button type="button" className="pdf-editor-command-export-button" disabled={exportDisabled}
          onClick={exportPdf}
          title={totalAnns === 0 ? 'Add an annotation before exporting' : 'Export annotated PDF'}>
          <Download size={17} aria-hidden="true" />
          <span>{processing ? 'Exporting…' : 'Export PDF'}</span>
          {totalAnns > 0 && !processing && (
            <span className="pdf-editor-command-annotation-count" aria-label={`${totalAnns} annotations`}>
              {totalAnns}
            </span>
          )}
        </button>
      </div>
    </header>
    <footer className="pdf-editor-canvas-footer" aria-label="Canvas navigation controls">
      <div className="pdf-editor-command-navigation" aria-label="Page and zoom controls">
        <div className="pdf-editor-command-page-controls" role="group" aria-label="Page navigation">
          <button type="button" className="pdf-editor-command-icon-button" disabled={currentPage <= 1}
            onClick={goToPreviousPage} aria-label="Previous page" title="Previous page">
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <span className="pdf-editor-command-page-count" aria-label={`Page ${currentPage} of ${totalPages}`}>
            <strong>{currentPage}</strong><span aria-hidden="true"> / </span><span>{totalPages}</span>
          </span>
          <button type="button" className="pdf-editor-command-icon-button" disabled={currentPage >= totalPages}
            onClick={goToNextPage} aria-label="Next page" title="Next page">
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>

        <span className="pdf-editor-command-divider" aria-hidden="true" />

        <div className="pdf-editor-command-zoom-controls" role="group" aria-label="Zoom controls">
          <button type="button" className="pdf-editor-command-icon-button"
            onClick={() => setZoom(value => clamp(value - 0.1, ZOOM_MIN, ZOOM_MAX))}
            aria-label="Zoom out" title="Zoom out">
            <Minus size={17} aria-hidden="true" />
          </button>
          <span className="pdf-editor-command-zoom-value">{Math.round(zoom * 100)}%</span>
          <button type="button" className="pdf-editor-command-icon-button"
            onClick={() => setZoom(value => clamp(value + 0.1, ZOOM_MIN, ZOOM_MAX))}
            aria-label="Zoom in" title="Zoom in">
            <Plus size={17} aria-hidden="true" />
          </button>
          <button type="button" className="pdf-editor-command-fit-button" onClick={fitToWidth}
            aria-label="Fit page to width" title="Fit to width (Ctrl+0)">
            <Maximize2 size={15} aria-hidden="true" /><span>Fit</span>
          </button>
        </div>
      </div>
    </footer>
    </>
  );
}

export default memo(PdfEditorStatusBar);
