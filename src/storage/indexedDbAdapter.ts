import { openDB, type IDBPDatabase } from 'idb';
import { deserializeGameState, type SavePayload } from '../sim/serialize';
import type { SaveSlotMeta, SaveStorageAdapter, SavedGameRecord } from './adapter';

const DB_NAME = 'silicon-dawn-saves';
const DB_VERSION = 1;
const STORE_NAME = 'slots';

interface StoredSlotRow {
  meta: SaveSlotMeta;
  encoding: 'gzip-base64' | 'json';
  data: string;
}

async function compressJson(json: string): Promise<{ encoding: StoredSlotRow['encoding']; data: string; byteSize: number }> {
  const bytes = new TextEncoder().encode(json);
  if (typeof CompressionStream !== 'undefined') {
    try {
      const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
      const buf = new Uint8Array(await new Response(stream).arrayBuffer());
      let bin = '';
      for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
      return {
        encoding: 'gzip-base64',
        data: btoa(bin),
        byteSize: buf.byteLength,
      };
    } catch {
      // Fall back to plain JSON string
    }
  }
  return {
    encoding: 'json',
    data: json,
    byteSize: bytes.byteLength,
  };
}

async function decompressJson(encoding: StoredSlotRow['encoding'], data: string): Promise<string> {
  if (encoding === 'json') return data;
  const bin = atob(data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return await new Response(stream).text();
}

export class IndexedDbSaveAdapter implements SaveStorageAdapter {
  readonly kind = 'local' as const;
  private dbPromise: Promise<IDBPDatabase> | null = null;

  getProviderLabel(): string {
    return 'Local Browser (IndexedDB · Cloud-Ready)';
  }

  private getDb(): Promise<IDBPDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'meta.id' });
          }
        },
      });
    }
    return this.dbPromise;
  }

  async listSlots(): Promise<SaveSlotMeta[]> {
    const db = await this.getDb();
    const rows = (await db.getAll(STORE_NAME)) as StoredSlotRow[];
    return rows
      .map((r) => r.meta)
      .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
  }

  async saveSlot(
    id: string,
    name: string,
    kind: SaveSlotMeta['kind'],
    payload: SavePayload
  ): Promise<SaveSlotMeta> {
    const json = JSON.stringify(payload);
    const compressed = await compressJson(json);

    const meta: SaveSlotMeta = {
      id,
      name,
      kind,
      savedAt: payload.savedAt,
      elapsedSeconds: payload.state.elapsedSeconds,
      playerFaction: payload.state.config.playerFaction,
      aiFaction: payload.state.config.aiFaction,
      tick: payload.state.tick,
      checksum: payload.checksum,
      byteSize: compressed.byteSize,
      missionId: payload.state.missionId ?? undefined,
      mapId: payload.state.map.id,
    };

    const row: StoredSlotRow = {
      meta,
      encoding: compressed.encoding,
      data: compressed.data,
    };

    const db = await this.getDb();
    await db.put(STORE_NAME, row);
    return meta;
  }

  async loadSlot(id: string): Promise<SavedGameRecord | null> {
    const db = await this.getDb();
    const row = (await db.get(STORE_NAME, id)) as StoredSlotRow | undefined;
    if (!row) return null;
    const json = await decompressJson(row.encoding, row.data);
    const raw = JSON.parse(json) as SavePayload;
    const validatedState = deserializeGameState(raw);
    return {
      meta: row.meta,
      payload: {
        ...raw,
        state: validatedState,
      },
    };
  }

  async deleteSlot(id: string): Promise<void> {
    const db = await this.getDb();
    await db.delete(STORE_NAME, id);
  }
}
