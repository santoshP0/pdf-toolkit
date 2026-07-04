import { useState, useCallback } from 'react';
import usePdfTool from './shared/usePdfTool';
import { runQpdf } from './shared/qpdf';
import { Dropzone, FileInfo, ActionRow } from './shared/PdfToolUI';

const MODES = [
  { id: 'lock', label: '🔒 Add password' },
  { id: 'unlock', label: '🔓 Remove password' },
];

export default function ProtectPdf() {
  const {
    file, pageCount, processing, setProcessing,
    dragOver, inputRef, dropzoneProps, onInputChange, reset, exportPdfBytes, hasFile,
  } = usePdfTool();

  const [mode, setMode] = useState('lock');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');

  const handleReset = useCallback(() => {
    reset();
    setPassword('');
    setConfirm('');
    setError('');
  }, [reset]);

  const run = useCallback(async () => {
    if (!file || !password) return;
    if (mode === 'lock' && password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setError('');
    setProcessing(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const args = mode === 'lock'
        ? ['--encrypt', password, password, '256', '--', 'in.pdf', 'out.pdf']
        : [`--password=${password}`, '--decrypt', 'in.pdf', 'out.pdf'];

      const { exitCode, logs, read } = await runQpdf(args, 'in.pdf', bytes);
      const out = read('out.pdf');

      if (!out || exitCode === 2) {
        if (mode === 'unlock') {
          // A failed decrypt on a real PDF is almost always a bad password.
          setError('Wrong password, or this file is not password-protected.');
        } else {
          setError('Could not process this file. ' + (logs[logs.length - 1] || ''));
        }
        setProcessing(false);
        return;
      }

      exportPdfBytes(out, mode === 'lock' ? 'protected.pdf' : 'unlocked.pdf');
      handleReset();
    } catch (err) {
      setError('Error: ' + err.message);
      setProcessing(false);
    }
  }, [file, password, confirm, mode, setProcessing, exportPdfBytes, handleReset]);

  const canRun = password && (mode === 'unlock' || password === confirm);

  return (
    <div>
      {!hasFile ? (
        <Dropzone
          dragOver={dragOver}
          dropzoneProps={dropzoneProps}
          inputRef={inputRef}
          onInputChange={onInputChange}
          icon={'🔒'}
        />
      ) : (
        <>
          <FileInfo file={file} pageCount={pageCount} onRemove={handleReset} />

          <div className="controls">
            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
              {MODES.map(m => (
                <button
                  key={m.id}
                  className={`btn ${mode === m.id ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '6px 14px', fontSize: 13 }}
                  onClick={() => { setMode(m.id); setError(''); }}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <h3>{mode === 'lock' ? 'Set a password (AES-256)' : 'Enter the current password'}</h3>
            <div className="control-row">
              <span className="control-label">Password</span>
              <input
                className="control-input"
                type={show ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                placeholder={mode === 'lock' ? 'choose a password' : 'current password'}
                style={{ flex: 1, minWidth: 180 }}
              />
            </div>
            {mode === 'lock' && (
              <div className="control-row">
                <span className="control-label">Confirm</span>
                <input
                  className="control-input"
                  type={show ? 'text' : 'password'}
                  value={confirm}
                  onChange={e => { setConfirm(e.target.value); setError(''); }}
                  placeholder="repeat password"
                  style={{ flex: 1, minWidth: 180 }}
                />
              </div>
            )}
            <div className="control-row">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={show} onChange={e => setShow(e.target.checked)} />
                <span className="control-label" style={{ margin: 0 }}>Show password</span>
              </label>
            </div>

            {error && (
              <div style={{ color: 'var(--cat-security, #e17055)', fontSize: 13, marginTop: 4 }}>
                {error}
              </div>
            )}
          </div>

          <ActionRow>
            <button className="btn btn-primary" disabled={processing || !canRun} onClick={run}>
              {processing
                ? (mode === 'lock' ? 'Encrypting...' : 'Decrypting...')
                : (mode === 'lock' ? 'Protect PDF' : 'Unlock PDF')}
            </button>
            <button className="btn btn-secondary" onClick={handleReset}>
              Choose another file
            </button>
          </ActionRow>
        </>
      )}
    </div>
  );
}
