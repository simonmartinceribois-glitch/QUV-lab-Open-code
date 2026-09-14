/**
 * QUV-Lab — MediaStorageService (IndexedDB)
 *
 * Séparation stricte de la persistance médias :
 *   localStorage  = métadonnées / JSON uniquement (aucune donnée binaire photo)
 *   IndexedDB     = contenu binaire réel des médias (Blob/File)
 *
 * Le port (MediaStoragePort) est partagé par la production (IndexedDB via `idb`)
 * et par les tests (backends injectables : fake-indexeddb ou backend mémoire).
 * Aucune Data URI, Base64, Blob ou File ne doit transiter par les métadonnées.
 */
import { openDB, type IDBPDatabase, type DBSchema } from 'idb';

export interface MediaRecord {
  key: string;
  blob: Blob;
  mimeType: string;
  createdAt: string;
}

/**
 * Port minimal de stockage média. Il est implémenté :
 *  - en production par IndexedDBMediaStorage (idb)
 *  - dans les tests par un backend injectable dédié
 */
export interface MediaStoragePort {
  put(file: File | Blob, key: string, mimeType?: string): Promise<void>;
  get(key: string): Promise<MediaRecord | null>;
  delete(key: string): Promise<void>;
  has(key: string): Promise<boolean>;
  keys(): Promise<string[]>;
}

interface MediaDBSchema extends DBSchema {
  media: {
    key: string;
    value: MediaRecord;
  };
}

const DEFAULT_DB_NAME = 'quv_lab_media_v1';

export class MediaStorageService implements MediaStoragePort {
  public readonly dbName: string;
  private dbPromise: Promise<IDBPDatabase<MediaDBSchema>> | null = null;

  constructor(dbName: string = DEFAULT_DB_NAME) {
    this.dbName = dbName;
  }

  private db(): Promise<IDBPDatabase<MediaDBSchema>> {
    if (!this.dbPromise) {
      this.dbPromise = openDB<MediaDBSchema>(this.dbName, 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('media')) {
            db.createObjectStore('media', { keyPath: 'key' });
          }
        }
      });
    }
    return this.dbPromise;
  }

  public async put(file: File | Blob, key: string, mimeType?: string): Promise<void> {
    if (!key) {
      throw new Error('MediaStorage: clé de stockage manquante');
    }
    const type = mimeType ?? file.type;
    if (!type) {
      throw new Error('MediaStorage: type MIME absent');
    }
    const record: MediaRecord = {
      key,
      blob: file,
      mimeType: type,
      createdAt: new Date().toISOString()
    };
    const db = await this.db();
    await db.put('media', record);
  }

  public async get(key: string): Promise<MediaRecord | null> {
    const db = await this.db();
    const record = await db.get('media', key);
    return record ?? null;
  }

  public async delete(key: string): Promise<void> {
    const db = await this.db();
    await db.delete('media', key);
  }

  public async has(key: string): Promise<boolean> {
    const db = await this.db();
    const record = await db.get('media', key);
    return record !== undefined;
  }

  public async keys(): Promise<string[]> {
    const db = await this.db();
    return (await db.getAllKeys('media')) as string[];
  }

  public async clear(): Promise<void> {
    const db = await this.db();
    const tx = db.transaction('media', 'readwrite');
    await tx.store.clear();
    await tx.done;
  }

  public async close(): Promise<void> {
    if (this.dbPromise) {
      const db = await this.dbPromise;
      db.close();
      this.dbPromise = null;
    }
  }
}

/**
 * Instance singleton utilisée par l'application (IndexedDB réelle).
 */
export const mediaStorage: MediaStoragePort = new MediaStorageService();