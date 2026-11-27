import { deserializeGameState, type SavePayload } from '../sim/serialize';
import type { GameState } from '../sim/types';

export function exportSaveToFile(payload: SavePayload, fileNameBase: string): void {
  const safeName = fileNameBase.replace(/[^a-z0-9_-]+/gi, '_').replace(/^_+|_+$/g, '') || 'silicon_dawn_save';
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeName}.sdawn`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function importSaveFromFile(file: File): Promise<{ state: GameState; payload: SavePayload }> {
  const text = await file.text();
  const parsed = JSON.parse(text) as SavePayload;
  const state = deserializeGameState(parsed);
  return {
    state,
    payload: {
      ...parsed,
      state,
    },
  };
}
