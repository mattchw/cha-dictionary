import type { DictEntry } from "@/lib/types";

const DB_NAME = "cha-dictionary-offline";
const STORE = "entries";
const MAX_ENTRIES = 30;

type CachedRow = {
  word: string;
  entry: DictEntry;
  savedAt: number;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "word" });
        store.createIndex("savedAt", "savedAt");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getCachedEntry(word: string): Promise<DictEntry | null> {
  if (typeof indexedDB === "undefined") return null;
  const db = await openDb();
  const row = await new Promise<CachedRow | undefined>((resolve, reject) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).get(word.toLowerCase());
    req.onsuccess = () => resolve(req.result as CachedRow | undefined);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return row?.entry ?? null;
}

export async function saveCachedEntry(entry: DictEntry): Promise<void> {
  if (typeof indexedDB === "undefined" || !entry.wordZh) return;

  const db = await openDb();
  const word = entry.word.toLowerCase();
  const row: CachedRow = { word, entry, savedAt: Date.now() };

  const writeTx = db.transaction(STORE, "readwrite");
  writeTx.objectStore(STORE).put(row);
  await txDone(writeTx);

  const all = await new Promise<CachedRow[]>((resolve, reject) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result as CachedRow[]);
    req.onerror = () => reject(req.error);
  });

  if (all.length > MAX_ENTRIES) {
    const excess = all.sort((a, b) => a.savedAt - b.savedAt).slice(0, all.length - MAX_ENTRIES);
    const pruneTx = db.transaction(STORE, "readwrite");
    const store = pruneTx.objectStore(STORE);
    for (const old of excess) store.delete(old.word);
    await txDone(pruneTx);
  }

  db.close();
}

export async function listRecentEntries(limit = MAX_ENTRIES): Promise<DictEntry[]> {
  if (typeof indexedDB === "undefined") return [];
  const db = await openDb();
  const rows = await new Promise<CachedRow[]>((resolve, reject) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result as CachedRow[]);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return rows
    .sort((a, b) => b.savedAt - a.savedAt)
    .slice(0, limit)
    .map((r) => r.entry);
}
