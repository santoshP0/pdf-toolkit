import { memo } from 'react';

function PdfEditorContextMenu({
  S, contextMenu, setContextMenu,
  pageAnns, cloneAnn, moveAnn,
  deleteAnn, duplicateAnn, bringForward, sendBackward,
  clipboard, setClipboard,
  setAnnsH, setSelectedIdx, currentPage,
}) {
  if (!contextMenu) return null;

  return (
    <div style={S.ctxMenu(contextMenu.x, contextMenu.y)}>
      {contextMenu.annIdx !== null ? (
        <>
          <button style={S.ctxItem(false)}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            onClick={() => {
              setClipboard({ ann: cloneAnn(pageAnns[contextMenu.annIdx]), cut: true });
              deleteAnn(contextMenu.annIdx); setContextMenu(null);
            }}>Cut</button>
          <button style={S.ctxItem(false)}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            onClick={() => {
              setClipboard({ ann: cloneAnn(pageAnns[contextMenu.annIdx]) });
              setContextMenu(null);
            }}>Copy</button>
          <button style={S.ctxItem(false)}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            onClick={() => { duplicateAnn(contextMenu.annIdx); setContextMenu(null); }}>Duplicate</button>
          <div style={S.ctxDivider} />
          <button style={S.ctxItem(false)}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            onClick={() => { bringForward(contextMenu.annIdx); setContextMenu(null); }}>Bring forward</button>
          <button style={S.ctxItem(false)}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            onClick={() => { sendBackward(contextMenu.annIdx); setContextMenu(null); }}>Send backward</button>
          <div style={S.ctxDivider} />
          <button style={S.ctxItem(true)}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            onClick={() => { deleteAnn(contextMenu.annIdx); setContextMenu(null); }}>Delete</button>
        </>
      ) : (
        <>
          {clipboard && (
            <button style={S.ctxItem(false)}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              onClick={() => {
                const pasted = moveAnn(cloneAnn(clipboard.ann), 15, 15);
                setAnnsH(prev => ({ ...prev, [currentPage]: [...(prev[currentPage] || []), pasted] }));
                setSelectedIdx(pageAnns.length);
                setContextMenu(null);
              }}>Paste</button>
          )}
          <button style={S.ctxItem(true)}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            onClick={() => {
              setAnnsH(prev => ({ ...prev, [currentPage]: [] }));
              setSelectedIdx(null); setContextMenu(null);
            }}>Clear page</button>
        </>
      )}
    </div>
  );
}

function PdfEditorConfirmModal({ confirmModal, setConfirmModal }) {
  if (!confirmModal) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)',
    }} onClick={() => setConfirmModal(null)}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--surface)',
        border: '2px solid var(--border)',
        borderRadius: 16,
        padding: '28px 32px 24px',
        minWidth: 320, maxWidth: 400,
        boxShadow: '0 20px 60px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.05)',
        fontFamily: 'var(--font-sans)',
        position: 'relative',
        animation: 'fadeUp 0.2s ease both',
      }}>
        <div style={{
          fontSize: 17, fontWeight: 700,
          color: 'var(--sketch-text)',
          fontFamily: 'var(--font-hand)',
          marginBottom: 8,
        }}>
          {confirmModal.title}
        </div>
        <div style={{
          fontSize: 13, lineHeight: 1.6,
          color: 'var(--text-muted)',
          marginBottom: 24,
        }}>
          {confirmModal.message}
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={() => setConfirmModal(null)}
            style={{
              padding: '8px 20px', borderRadius: 8,
              border: '1.5px solid var(--border)',
              background: 'var(--surface)', color: 'var(--sketch-text)',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              transition: 'all 0.1s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--surface)'}
          >
            Cancel
          </button>
          <button
            onClick={() => { confirmModal.onConfirm(); setConfirmModal(null); }}
            style={{
              padding: '8px 20px', borderRadius: 8,
              border: '1.5px solid transparent',
              background: confirmModal.danger ? '#ef4444' : 'var(--cat-edit)',
              color: '#fff',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              transition: 'all 0.1s',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            {confirmModal.confirmLabel || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

const MemoContextMenu = memo(PdfEditorContextMenu);
const MemoConfirmModal = memo(PdfEditorConfirmModal);

export { MemoContextMenu as PdfEditorContextMenu, MemoConfirmModal as PdfEditorConfirmModal };
