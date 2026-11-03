const DB_NAME = 'base44-toolkit-v4';
const DB_VERSION = 2;
let dbPromise;

export function openDatabase() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('jobs')) db.createObjectStore('jobs', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('entries')) {
        const store = db.createObjectStore('entries', { keyPath: ['jobId', 'path'] });
        store.createIndex('byJob', 'jobId', { unique: false });
      }
      if (!db.objectStoreNames.contains('snapshots')) db.createObjectStore('snapshots', { keyPath: 'projectId' });
      if (!db.objectStoreNames.contains('pendingSnapshots')) db.createObjectStore('pendingSnapshots', { keyPath: 'jobId' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

export async function getJob(id) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction('jobs').objectStore('jobs').get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}
export async function putJob(job) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('jobs', 'readwrite');
    tx.objectStore('jobs').put(job);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}
export async function listJobs() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction('jobs').objectStore('jobs').getAll();
    request.onsuccess = () => resolve((request.result || []).sort((a, b) => b.createdAt - a.createdAt));
    request.onerror = () => reject(request.error);
  });
}
export async function putEntry(entry) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('entries', 'readwrite');
    tx.objectStore('entries').put(entry);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}
export async function getEntries(jobId) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction('entries').objectStore('entries').index('byJob').getAll(IDBKeyRange.only(jobId));
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}
export async function deleteEntries(jobId) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('entries', 'readwrite');
    const request = tx.objectStore('entries').index('byJob').openCursor(IDBKeyRange.only(jobId));
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) { cursor.delete(); cursor.continue(); }
    };
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

export async function getSnapshot(projectId) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction('snapshots').objectStore('snapshots').get(projectId);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}
export async function putSnapshot(snapshot) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('snapshots', 'readwrite'); tx.objectStore('snapshots').put(snapshot);
    tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
  });
}
export async function putPendingSnapshot(snapshot) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pendingSnapshots', 'readwrite'); tx.objectStore('pendingSnapshots').put(snapshot);
    tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
  });
}
export async function getPendingSnapshot(jobId) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction('pendingSnapshots').objectStore('pendingSnapshots').get(jobId);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}
export async function deletePendingSnapshot(jobId) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pendingSnapshots', 'readwrite'); tx.objectStore('pendingSnapshots').delete(jobId);
    tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
  });
}
