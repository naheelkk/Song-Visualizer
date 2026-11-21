const DB_NAME = 'prism-audio-db';
const DB_VERSION = 1;
const STORE_NAME = 'tracks';

let dbInstance = null;

function hasIndexedDB() {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

function openDatabase() {
  if (!hasIndexedDB()) {
    return Promise.resolve(null);
  }
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('order', 'order', { unique: false });
        store.createIndex('addedAt', 'addedAt', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      dbInstance.onversionchange = () => {
        dbInstance.close();
        dbInstance = null;
      };
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      console.warn('IndexedDB failed to open:', event.target.error);
      resolve(null);
    };
  });
}

/**
 * Save one or multiple tracks into persistent storage.
 */
export async function saveTracks(tracks) {
  if (!tracks || !tracks.length) return;
  const db = await openDatabase();
  if (!db) return;

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      tx.oncomplete = () => resolve();
      tx.onerror = (event) => {
        console.warn('IndexedDB save transaction failed:', event.target.error);
        resolve(); // Best-effort persistence; don't break app flow
      };

      for (const track of tracks) {
        const record = {
          id: track.id,
          name: track.file?.name || track.title || 'track',
          file: track.file, // Blob or File
          mime: track.mime || 'audio/mpeg',
          format: track.format || 'AUDIO',
          title: track.title || 'Untitled',
          artist: track.artist || 'Unknown artist',
          album: track.album || '',
          artBlob: track.artBlob || null,
          peaks: track.peaks ? Array.from(track.peaks) : null,
          duration: Number(track.duration) || 0,
          order: typeof track.order === 'number' ? track.order : 0,
          addedAt: track.addedAt || Date.now(),
        };
        store.put(record);
      }
    } catch (error) {
      console.warn('Error saving tracks to IndexedDB:', error);
      resolve();
    }
  });
}

/**
 * Load all tracks from persistent storage, ordered by their saved playlist position.
 */
export async function loadTracks() {
  const db = await openDatabase();
  if (!db) return [];

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const records = request.result || [];
        records.sort((a, b) => {
          const orderDiff = (a.order ?? 0) - (b.order ?? 0);
          return orderDiff !== 0 ? orderDiff : (a.addedAt ?? 0) - (b.addedAt ?? 0);
        });

        const tracks = records.map((record) => {
          let file = record.file;
          if (!(file instanceof File) && file instanceof Blob) {
            file = new File([file], record.name || `${record.title}.${record.format?.toLowerCase() || 'mp3'}`, {
              type: record.mime || file.type || 'audio/mpeg',
              lastModified: record.addedAt || Date.now(),
            });
          }

          const url = file ? URL.createObjectURL(file) : '';
          const art = record.artBlob ? URL.createObjectURL(record.artBlob) : null;

          return {
            id: record.id,
            file,
            url,
            mime: record.mime || 'audio/mpeg',
            format: record.format || 'AUDIO',
            title: record.title || 'Untitled',
            artist: record.artist || 'Unknown artist',
            album: record.album || '',
            art,
            artBlob: record.artBlob || null,
            peaks: record.peaks ? new Float32Array(record.peaks) : null,
            duration: Number(record.duration) || 0,
            order: record.order ?? 0,
            addedAt: record.addedAt || Date.now(),
          };
        });

        resolve(tracks);
      };

      request.onerror = (event) => {
        console.warn('Failed to load tracks from IndexedDB:', event.target.error);
        resolve([]);
      };
    } catch (error) {
      console.warn('Error reading tracks from IndexedDB:', error);
      resolve([]);
    }
  });
}

/**
 * Remove a single track from storage.
 */
export async function deleteTrack(id) {
  if (!id) return;
  const db = await openDatabase();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Clear all tracks from storage.
 */
export async function clearAllTracks() {
  const db = await openDatabase();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Update metadata such as computed duration or waveform peaks for a track.
 */
export async function updateTrackMetadata(id, updates) {
  if (!id || !updates) return;
  const db = await openDatabase();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);

      req.onsuccess = () => {
        const record = req.result;
        if (!record) {
          resolve();
          return;
        }

        if (Number.isFinite(updates.duration) && updates.duration > 0) {
          record.duration = updates.duration;
        }
        if (updates.peaks) {
          record.peaks = Array.from(updates.peaks);
        }
        if (typeof updates.order === 'number') {
          record.order = updates.order;
        }
        store.put(record);
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Synchronize the order of all tracks in storage to match the current in-memory playlist.
 */
export async function syncTrackOrder(tracks) {
  if (!tracks || !tracks.length) return;
  const db = await openDatabase();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      tracks.forEach((track, index) => {
        const req = store.get(track.id);
        req.onsuccess = () => {
          const record = req.result;
          if (record) {
            record.order = index;
            store.put(record);
          }
        };
      });

      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}
