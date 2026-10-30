import { storage } from './shared/storage';
const DB_NAME = 'PdfEditorDB';
const DB_VERSION = 1;
const STORE_NAME = 'editor_state';
export const PDF_EDITOR_SESSION_MAX_AGE = 30 * 24 * 60 * 60 * 1000;
export const PDF_EDITOR_UPDATED_AT_KEY = 'pdf_editor_updated_at';

const EDITOR_LOCAL_STORAGE_KEYS = [
  'pdf_editor_annotations',
  'pdf_editor_current_page',
  'pdf_editor_zoom',
  PDF_EDITOR_UPDATED_AT_KEY,
];

export function clearPDFEditorLocalStorage() {
  EDITOR_LOCAL_STORAGE_KEYS.forEach((key) => storage.removeItem(key));
}

export function isPDFEditorSessionExpired(timestamp) {
  const savedAt = Number(timestamp);
  return !Number.isFinite(savedAt) || savedAt <= 0 || Date.now() - savedAt >= PDF_EDITOR_SESSION_MAX_AGE;
}

export function clearExpiredPDFEditorLocalStorage() {
  const updatedAt = storage.getItem(PDF_EDITOR_UPDATED_AT_KEY);
  if (updatedAt && isPDFEditorSessionExpired(updatedAt)) {
    clearPDFEditorLocalStorage();
    return true;
  }
  return false;
}

function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

export async function savePDFToDB(fileBytes, fileName) {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put({ bytes: fileBytes, name: fileName, timestamp: Date.now() }, 'active_pdf');
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  } catch (err) {
    console.error('Failed to save PDF to IndexedDB:', err);
  }
}

export async function loadPDFFromDB() {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get('active_pdf');
      tx.oncomplete = () => db.close();
      tx.onerror = () => { db.close(); reject(tx.error); };
      req.onsuccess = () => {
        const saved = req.result;
        if (saved && isPDFEditorSessionExpired(saved.timestamp)) {
          db.close();
          clearPDFEditorLocalStorage();
          clearPDFFromDB().finally(() => resolve(null));
          return;
        }
        resolve(saved);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Failed to load PDF from IndexedDB:', err);
    return null;
  }
}

export async function clearPDFFromDB() {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete('active_pdf');
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  } catch (err) {
    console.error('Failed to clear PDF from IndexedDB:', err);
  }
}
