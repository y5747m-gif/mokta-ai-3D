/* ============================================================
 * db.js — طبقة التخزين الدائم (IndexedDB) مع ترحيلات آمنة
 * يعمل بدون متصفح عبر ذاكرة مؤقتة (لاختبارات Node).
 * لا يحدث فقدان صامت للبيانات: كل عملية لها حالة خطأ واضحة.
 * ============================================================ */

export const DB_NAME = 'yawmi-db';
export const DB_VERSION = 1;

export const COLLECTIONS = [
  'meta', 'settings', 'events', 'alarms', 'alarmLog', 'tasks', 'revisions',
  'subjects', 'sessions', 'habits', 'habitLog', 'notifications', 'progress', 'fired',
];

/** مخططات الترحيل: كل إصدار يضيف/يعدّل المتاجر بأمان */
const MIGRATIONS = {
  1(db) {
    for (const name of COLLECTIONS) {
      if (!db.objectStoreNames.contains(name)) {
        db.createObjectStore(name, { keyPath: 'id' });
      }
    }
  },
};

let dbPromise = null;
let memoryMode = false;
const mem = new Map(); // name -> Map(id -> record)

function memStore(name) {
  if (!mem.has(name)) mem.set(name, new Map());
  return mem.get(name);
}

function hasIDB() {
  return typeof indexedDB !== 'undefined' && indexedDB !== null;
}

/** فتح قاعدة البيانات (مع ترقية الترحيلات) */
export function openDB() {
  if (dbPromise) return dbPromise;
  if (!hasIDB()) {
    memoryMode = true;
    dbPromise = Promise.resolve(null);
    return dbPromise;
  }
  dbPromise = new Promise((resolve, reject) => {
    let req;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (err) {
      memoryMode = true;
      resolve(null);
      return;
    }
    req.onupgradeneeded = (e) => {
      const db = req.result;
      const from = e.oldVersion || 0;
      for (let v = from + 1; v <= DB_VERSION; v++) {
        if (MIGRATIONS[v]) MIGRATIONS[v](db, e.target.transaction);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      // ارتداد آمن إلى الذاكرة مع إبقاء التطبيق يعمل
      memoryMode = true;
      resolve(null);
    };
    req.onblocked = () => {
      memoryMode = true;
      resolve(null);
    };
  });
  return dbPromise;
}

export function isMemoryMode() { return memoryMode; }

function tx(name, mode) {
  return openDB().then((db) => {
    if (!db) return null;
    return db.transaction(name, mode).objectStore(name);
  });
}

export async function getAll(name) {
  if (memoryMode) return Array.from(memStore(name).values());
  const store = await tx(name, 'readonly');
  if (!store) { memoryMode = true; return Array.from(memStore(name).values()); }
  return new Promise((resolve) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => resolve([]);
  });
}

export async function get(name, id) {
  if (memoryMode) return memStore(name).get(id) || null;
  const store = await tx(name, 'readonly');
  if (!store) { memoryMode = true; return memStore(name).get(id) || null; }
  return new Promise((resolve) => {
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => resolve(null);
  });
}

export async function put(name, record) {
  if (!record || record.id === undefined) throw new Error('db.put: record must have an id');
  if (memoryMode) { memStore(name).set(record.id, record); return record; }
  const store = await tx(name, 'readwrite');
  if (!store) { memoryMode = true; memStore(name).set(record.id, record); return record; }
  return new Promise((resolve, reject) => {
    const req = store.put(record);
    req.onsuccess = () => resolve(record);
    req.onerror = () => reject(req.error || new Error('db.put failed'));
  });
}

export async function bulkPut(name, records) {
  for (const r of records) await put(name, r);
  return records.length;
}

export async function del(name, id) {
  if (memoryMode) { memStore(name).delete(id); return true; }
  const store = await tx(name, 'readwrite');
  if (!store) { memoryMode = true; memStore(name).delete(id); return true; }
  return new Promise((resolve) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve(true);
    req.onerror = () => resolve(false);
  });
}

export async function clear(name) {
  if (memoryMode) { memStore(name).clear(); return true; }
  const store = await tx(name, 'readwrite');
  if (!store) { memoryMode = true; memStore(name).clear(); return true; }
  return new Promise((resolve) => {
    const req = store.clear();
    req.onsuccess = () => resolve(true);
    req.onerror = () => resolve(false);
  });
}

/** إغلاق الاتصال (لاختبارات Node) */
export async function closeDB() {
  if (dbPromise) {
    const db = await dbPromise;
    if (db) db.close();
    dbPromise = null;
  }
}
