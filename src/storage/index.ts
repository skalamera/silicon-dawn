import type { SaveStorageAdapter } from './adapter';
import { CloudSyncAdapter, type CloudSyncConfig } from './cloudAdapter';
import { IndexedDbSaveAdapter } from './indexedDbAdapter';

export type { SaveSlotMeta, SavedGameRecord, SaveStorageAdapter } from './adapter';
export { CloudSyncAdapter, type CloudSyncConfig } from './cloudAdapter';
export { exportSaveToFile, importSaveFromFile } from './portableFile';

export function createStorageAdapter(cloudConfig?: CloudSyncConfig): SaveStorageAdapter {
  if (cloudConfig) {
    return new CloudSyncAdapter(cloudConfig);
  }
  return new IndexedDbSaveAdapter();
}

export const saveStorage: SaveStorageAdapter = createStorageAdapter();
