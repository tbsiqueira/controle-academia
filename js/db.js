'use strict';

/* IndexedDB layer for Meu Treino. All data stays on the device. */

const DB_NAME = 'meu-treino';
const DB_VERSION = 1;
const STORES = ['workouts', 'exercises', 'workoutTypes', 'settings', 'colinha'];

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains('workouts')) {
        const store = db.createObjectStore('workouts', { keyPath: 'id' });
        store.createIndex('date', 'date', { unique: false });
      }

      if (!db.objectStoreNames.contains('exercises')) {
        const store = db.createObjectStore('exercises', { keyPath: 'id' });
        store.createIndex('name', 'name', { unique: false });
      }

      if (!db.objectStoreNames.contains('workoutTypes')) {
        const store = db.createObjectStore('workoutTypes', { keyPath: 'id' });
        store.createIndex('name', 'name', { unique: false });
      }

      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('colinha')) {
        db.createObjectStore('colinha', { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

function dbRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function dbAll(storeName) {
  const db = await openDb();
  const tx = db.transaction(storeName, 'readonly');
  return dbRequest(tx.objectStore(storeName).getAll());
}

async function dbGet(storeName, id) {
  const db = await openDb();
  const tx = db.transaction(storeName, 'readonly');
  return dbRequest(tx.objectStore(storeName).get(id));
}

async function dbPut(storeName, value) {
  const db = await openDb();
  const tx = db.transaction(storeName, 'readwrite');
  await dbRequest(tx.objectStore(storeName).put(value));
  return value;
}

async function dbDelete(storeName, id) {
  const db = await openDb();
  const tx = db.transaction(storeName, 'readwrite');
  return dbRequest(tx.objectStore(storeName).delete(id));
}

async function dbClear(storeName) {
  const db = await openDb();
  const tx = db.transaction(storeName, 'readwrite');
  return dbRequest(tx.objectStore(storeName).clear());
}
