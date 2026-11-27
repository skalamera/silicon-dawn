import type { FactionId } from '../data/defs';
import type { SavePayload } from '../sim/serialize';

export interface SaveSlotMeta {
  id: string;
  name: string;
  kind: 'manual' | 'autosave' | 'quicksave';
  savedAt: string;
  elapsedSeconds: number;
  playerFaction: FactionId;
  aiFaction: FactionId;
  tick: number;
  checksum: string;
  byteSize: number;
  missionId?: string;
  mapId?: string;
}

export interface SavedGameRecord {
  meta: SaveSlotMeta;
  payload: SavePayload;
}

/**
 * Storage boundary designed for local-first IndexedDB persistence today,
 * with a drop-in CloudSyncAdapter path for cross-device account sync later.
 */
export interface SaveStorageAdapter {
  readonly kind: 'local' | 'cloud';
  getProviderLabel(): string;
  listSlots(): Promise<SaveSlotMeta[]>;
  saveSlot(id: string, name: string, kind: SaveSlotMeta['kind'], payload: SavePayload): Promise<SaveSlotMeta>;
  loadSlot(id: string): Promise<SavedGameRecord | null>;
  deleteSlot(id: string): Promise<void>;
}
