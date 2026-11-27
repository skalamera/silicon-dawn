import type { SavePayload } from '../sim/serialize';
import type { SaveSlotMeta, SaveStorageAdapter, SavedGameRecord } from './adapter';
import { IndexedDbSaveAdapter } from './indexedDbAdapter';

export interface CloudSyncConfig {
  baseUrl: string;
  getAuthToken: () => Promise<string | null>;
}

/**
 * Offline-first CloudSyncAdapter:
 * Reads/writes instantly to local IndexedDB and mirrors to a remote REST endpoint
 * when online and authenticated.
 */
export class CloudSyncAdapter implements SaveStorageAdapter {
  readonly kind = 'cloud' as const;
  private localCache = new IndexedDbSaveAdapter();

  constructor(private config: CloudSyncConfig) {}

  getProviderLabel(): string {
    return 'Cloud Sync + Local Cache';
  }

  private async authHeaders(): Promise<Record<string, string> | null> {
    const token = await this.config.getAuthToken();
    if (!token) return null;
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }

  async listSlots(): Promise<SaveSlotMeta[]> {
    const localSlots = await this.localCache.listSlots();
    try {
      const headers = await this.authHeaders();
      if (!headers || typeof navigator === 'undefined' || !navigator.onLine) {
        return localSlots;
      }
      const res = await fetch(`${this.config.baseUrl}/saves`, { headers });
      if (!res.ok) return localSlots;
      const remote = (await res.json()) as SaveSlotMeta[];
      const merged = new Map<string, SaveSlotMeta>();
      for (const s of localSlots) merged.set(s.id, s);
      for (const s of remote) merged.set(s.id, s);
      return Array.from(merged.values()).sort(
        (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
      );
    } catch {
      return localSlots;
    }
  }

  async saveSlot(
    id: string,
    name: string,
    kind: SaveSlotMeta['kind'],
    payload: SavePayload
  ): Promise<SaveSlotMeta> {
    const meta = await this.localCache.saveSlot(id, name, kind, payload);
    try {
      const headers = await this.authHeaders();
      if (headers && (typeof navigator === 'undefined' || navigator.onLine)) {
        await fetch(`${this.config.baseUrl}/saves/${encodeURIComponent(id)}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ meta, payload }),
        });
      }
    } catch {
      // Offline fallback: local IndexedDB copy is already safely persisted
    }
    return meta;
  }

  async loadSlot(id: string): Promise<SavedGameRecord | null> {
    const local = await this.localCache.loadSlot(id);
    if (local) return local;
    try {
      const headers = await this.authHeaders();
      if (!headers || (typeof navigator !== 'undefined' && !navigator.onLine)) return null;
      const res = await fetch(`${this.config.baseUrl}/saves/${encodeURIComponent(id)}`, { headers });
      if (!res.ok) return null;
      return (await res.json()) as SavedGameRecord;
    } catch {
      return null;
    }
  }

  async deleteSlot(id: string): Promise<void> {
    await this.localCache.deleteSlot(id);
    try {
      const headers = await this.authHeaders();
      if (headers && (typeof navigator === 'undefined' || navigator.onLine)) {
        await fetch(`${this.config.baseUrl}/saves/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers,
        });
      }
    } catch {
      // Ignore offline delete sync failure
    }
  }
}
