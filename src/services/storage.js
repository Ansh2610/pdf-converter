// src/services/storage.js
// Robust client storage for scans. Primary: IndexedDB (Blobs). Fallback: localStorage (data URLs).

const DB_NAME = "pokedex-scanner";
const STORE = "scans";
// Bump this if schema changes
let DB_VERSION = 2;

// ---------- small utils ----------
function hasIndexedDB() {
  try { return typeof window !== "undefined" && !!window.indexedDB; } catch { return false; }
}
function safeId() {
  return (crypto?.randomUUID?.() || `id_${Date.now()}_${Math.random().toString(16).slice(2)}`);
}
function blobToDataURL(blob) {
  return new Promise((res, rej) => {
    if (!blob) return res("");
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result));
    fr.onerror = () => rej(fr.error || new Error("read blob failed"));
    fr.readAsDataURL(blob);
  });
}
function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error || new Error("tx aborted"));
    tx.onerror = () => reject(tx.error || new Error("tx error"));
  });
}

// ---------- IndexedDB open / ensure ----------
function openRaw(version) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, version);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: "id" });
        // indexes are optional; code tolerates their absence
        os.createIndex("userId", "userId", { unique: false });
        os.createIndex("userId_ts", ["userId", "ts"], { unique: false });
      } else {
        // If store exists but indexes don't, try to add them
        const os = req.transaction.objectStore(STORE);
        if (!os.indexNames.contains("userId")) os.createIndex("userId", "userId", { unique: false });
        if (!os.indexNames.contains("userId_ts")) os.createIndex("userId_ts", ["userId", "ts"], { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("open IDB failed"));
  });
}

// Ensure store exists. If not, auto-repair by bumping the version once.
async function openEnsured() {
  const db = await openRaw(DB_VERSION);
  if (!db.objectStoreNames.contains(STORE)) {
    db.close?.();
    DB_VERSION = db.version + 1;
    const fixed = await openRaw(DB_VERSION);
    if (!fixed.objectStoreNames.contains(STORE)) {
      fixed.close?.();
      throw new Error("Failed to create required object store");
    }
    return fixed;
  }
  return db;
}

let idbOK = hasIndexedDB();

// ---------- IDB CRUD ----------
async function idbSaveRecord(userId, meta, files) {
  const db = await openEnsured();
  const tx = db.transaction(STORE, "readwrite");
  const store = tx.objectStore(STORE);

  const id = meta.id || safeId();
  const rec = {
    id,
    userId,
    filename: meta.filename || files?.original?.name || "scan",
    ts: meta.ts || Date.now(),
    status: meta.status || "ok",
    mode: meta.mode || "original",
    autoCrop: !!meta.autoCrop,
    original: files?.original || null,   // Blob or null
    processed: files?.processed || null, // Blob or null
  };

  store.put(rec);
  await txDone(tx);
  db.close?.();
  return id;
}

async function idbGetRecords(userId) {
  const db = await openEnsured();
  const tx = db.transaction(STORE, "readonly");
  const store = tx.objectStore(STORE);

  const out = [];

  // Prefer userId_ts index if present, else userId, else full scan
  if (store.indexNames.contains("userId_ts")) {
    const idx = store.index("userId_ts");
    const range = IDBKeyRange.bound([userId, -Infinity], [userId, Infinity]);
    await new Promise((resolve, reject) => {
      const req = idx.openCursor(range);
      req.onsuccess = () => {
        const cur = req.result;
        if (cur) { out.push(cur.value); cur.continue(); } else resolve();
      };
      req.onerror = () => reject(req.error || new Error("cursor failed"));
    });
  } else if (store.indexNames.contains("userId")) {
    const idx = store.index("userId");
    const range = IDBKeyRange.only(userId);
    await new Promise((resolve, reject) => {
      const req = idx.openCursor(range);
      req.onsuccess = () => {
        const cur = req.result;
        if (cur) { out.push(cur.value); cur.continue(); } else resolve();
      };
      req.onerror = () => reject(req.error || new Error("cursor failed"));
    });
  } else {
    // very old DB without indexes
    await new Promise((resolve, reject) => {
      const req = store.openCursor();
      req.onsuccess = () => {
        const cur = req.result;
        if (cur) { if (cur.value?.userId === userId) out.push(cur.value); cur.continue(); }
        else resolve();
      };
      req.onerror = () => reject(req.error || new Error("cursor failed"));
    });
  }

  await txDone(tx);
  db.close?.();

  out.sort((a, b) => (b.ts || 0) - (a.ts || 0));
  return out;
}

async function idbRemoveRecord(userId, id) {
  const db = await openEnsured();
  const tx = db.transaction(STORE, "readwrite");
  const store = tx.objectStore(STORE);

  const rec = await new Promise((resolve, reject) => {
    const r = store.get(id);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error || new Error("get failed"));
  });
  if (rec?.userId === userId) store.delete(id);

  await txDone(tx);
  db.close?.();
  return true;
}

// ---------- localStorage fallback ----------
const LS_PREFIX = "ps_v1";
const lsKey = (userId, id) => `${LS_PREFIX}:${userId}:${id}`;
const lsListKey = (userId) => `${LS_PREFIX}:${userId}:__index__`;

function lsGetIndex(userId) {
  try { return JSON.parse(localStorage.getItem(lsListKey(userId)) || "[]"); } catch { return []; }
}
function lsSetIndex(userId, idx) {
  try { localStorage.setItem(lsListKey(userId), JSON.stringify(idx)); } catch {}
}

async function lsSaveRecord(userId, meta, files) {
  const id = meta.id || safeId();
  const originalURL = typeof files?.original === "string" ? files.original :
                      files?.original ? await blobToDataURL(files.original) : "";
  const processedURL = typeof files?.processed === "string" ? files.processed :
                       files?.processed ? await blobToDataURL(files.processed) : "";

  const rec = {
    id, userId,
    filename: meta.filename || files?.original?.name || "scan",
    ts: meta.ts || Date.now(),
    status: meta.status || "ok",
    mode: meta.mode || "original",
    autoCrop: !!meta.autoCrop,
    original: originalURL,    // string
    processed: processedURL,  // string
  };

  try {
    localStorage.setItem(lsKey(userId, id), JSON.stringify(rec));
    const idx = lsGetIndex(userId);
    if (!idx.includes(id)) { idx.push(id); lsSetIndex(userId, idx); }
  } catch {}
  return id;
}

async function lsGetRecords(userId) {
  const idx = lsGetIndex(userId);
  const out = [];
  for (const id of idx) {
    try {
      const raw = localStorage.getItem(lsKey(userId, id));
      if (raw) out.push(JSON.parse(raw));
    } catch {}
  }
  out.sort((a, b) => (b.ts || 0) - (a.ts || 0));
  return out;
}

async function lsRemoveRecord(userId, id) {
  try {
    localStorage.removeItem(lsKey(userId, id));
    lsSetIndex(userId, lsGetIndex(userId).filter((x) => x !== id));
  } catch {}
  return true;
}

// ---------- public API (auto-select backend each call) ----------
async function preferIDB(fn, ...args) {
  if (!idbOK) return null;
  try {
    return await fn(...args);
  } catch (e) {
    console.warn("[storage] IDB failed, falling back to localStorage:", e?.message || e);
    idbOK = false; // disable IDB for this session
    return null;
  }
}

export async function saveRecord(userId, meta, files) {
  if (!userId) throw new Error("saveRecord: userId required");
  const r = await preferIDB(idbSaveRecord, userId, meta, files);
  if (r !== null) return r;
  return lsSaveRecord(userId, meta, files);
}

export async function getRecords(userId) {
  if (!userId) return [];
  const r = await preferIDB(idbGetRecords, userId);
  if (r !== null) return r;
  return lsGetRecords(userId);
}

export async function removeRecord(userId, id) {
  if (!userId || !id) return false;
  const r = await preferIDB(idbRemoveRecord, userId, id);
  if (r !== null) return r;
  return lsRemoveRecord(userId, id);
}

export async function clearAll(userId) {
  if (!userId) return;
  const r = await preferIDB(async (uid) => {
    const db = await openEnsured();
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    // delete user rows
    if (store.indexNames.contains("userId")) {
      const idx = store.index("userId");
      const req = idx.openCursor(IDBKeyRange.only(uid));
      await new Promise((resolve, reject) => {
        req.onsuccess = () => {
          const cur = req.result;
          if (cur) { store.delete(cur.primaryKey); cur.continue(); } else resolve();
        };
        req.onerror = () => reject(req.error || new Error("clearAll cursor failed"));
      });
    } else {
      const req = store.openCursor();
      await new Promise((resolve, reject) => {
        req.onsuccess = () => {
          const cur = req.result;
          if (cur) { if (cur.value?.userId === uid) store.delete(cur.primaryKey); cur.continue(); }
          else resolve();
        };
        req.onerror = () => reject(req.error || new Error("clearAll cursor failed"));
      });
    }
    await txDone(tx);
    db.close?.();
  }, userId);
  if (r === null) {
    // fallback clear
    const idx = lsGetIndex(userId);
    idx.forEach((id) => localStorage.removeItem(lsKey(userId, id)));
    lsSetIndex(userId, []);
  }
}
