const DB_NAME = 'PdfEditorDB';
const DB_VERSION = 1;
const STORE_NAME = 'editor_state';

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
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(tx.error);
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
      req.onsuccess = () => resolve(req.result);
      req.onerror = (e) => reject(req.error);
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
      const req = store.delete('active_pdf');
      req.onsuccess = () => resolve();
      req.onerror = (e) => reject(req.error);
    });
  } catch (err) {
    console.error('Failed to clear PDF from IndexedDB:', err);
  }
}
