import type { BuildingId, UnitId } from '../data/defs';

export type SpriteKey = BuildingId | UnitId;

const BUILDING_SHEET_MAP: Array<[SpriteKey, number, number]> = [
  ['conyard', 0, 0],
  ['smr', 1, 0],
  ['server_farm', 2, 0],
  ['relay_hub', 0, 1],
  ['barracks', 1, 1],
  ['war_factory', 2, 1],
  ['iron_beam', 0, 2],
  ['hpm_tower', 1, 2],
  ['cryo_core', 2, 2],
];

const UNIT_SHEET_MAP: Array<[SpriteKey, number, number]> = [
  ['m1e4', 0, 0],
  ['type_99x', 1, 0],
  ['krasukha_q', 2, 0],
  ['tos_3', 0, 1],
  ['shahed_launcher', 1, 1],
  ['tunnel_crawler', 2, 1],
  ['relay_crawler', 0, 2],
  ['loyal_wingman', 1, 2],
  ['silicon_node', 2, 2],
];

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

function extractCellSprite(
  img: HTMLImageElement,
  col: number,
  row: number,
  opts: { stripBottomLabel?: boolean; flipX?: boolean } = {}
): { canvas: HTMLCanvasElement; thumbUrl: string } | null {
  const cellW = Math.floor(img.naturalWidth / 3);
  const cellH = Math.floor(img.naturalHeight / 3);
  if (cellW < 16 || cellH < 16) return null;

  const work = document.createElement('canvas');
  work.width = cellW;
  work.height = cellH;
  const wctx = work.getContext('2d');
  if (!wctx) return null;

  wctx.drawImage(img, col * cellW, row * cellH, cellW, cellH, 0, 0, cellW, cellH);
  const imgData = wctx.getImageData(0, 0, cellW, cellH);
  const d = imgData.data;

  // 1. Magenta (#FF00FF) chroma-key + despill
  const rowCounts = new Int32Array(cellH);
  for (let y = 0; y < cellH; y++) {
    for (let x = 0; x < cellW; x++) {
      const idx = (y * cellW + x) * 4;
      const r = d[idx];
      const g = d[idx + 1];
      const b = d[idx + 2];

      const magentaNess = Math.min(r, b) - g;
      if (magentaNess > 58 && r > 105 && b > 105) {
        d[idx + 3] = 0;
        continue;
      }
      if (magentaNess > 18 && r > 85 && b > 85) {
        const factor = 1 - (magentaNess - 18) / 40;
        d[idx + 3] = Math.round(d[idx + 3] * Math.max(0, Math.min(1, factor)));
        const cap = Math.min(255, g + 16);
        d[idx] = Math.min(r, cap);
        d[idx + 2] = Math.min(b, cap);
      }

      if (d[idx + 3] > 28) {
        rowCounts[y] += 1;
      }
    }
  }

  // 2. Strip separated text labels below buildings by finding the transparent gap after y >= 0.70*cellH
  if (opts.stripBottomLabel) {
    let cutoffY = cellH;
    const scanStart = Math.floor(cellH * 0.70);
    for (let y = scanStart; y < cellH; y++) {
      if (rowCounts[y] <= 2) {
        // Confirm there are non-empty rows below (the label) or just cut at the gap
        cutoffY = y;
        break;
      }
    }
    for (let y = cutoffY; y < cellH; y++) {
      rowCounts[y] = 0;
      for (let x = 0; x < cellW; x++) {
        d[(y * cellW + x) * 4 + 3] = 0;
      }
    }
  }

  // 3. Tight bounding box
  let minX = cellW;
  let minY = cellH;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < cellH; y++) {
    if (rowCounts[y] === 0) continue;
    for (let x = 0; x < cellW; x++) {
      if (d[(y * cellW + x) * 4 + 3] > 28) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  wctx.putImageData(imgData, 0, 0);
  if (maxX <= minX || maxY <= minY) return null;

  const trimW = maxX - minX + 1;
  const trimH = maxY - minY + 1;

  const out = document.createElement('canvas');
  out.width = 192;
  out.height = 192;
  const octx = out.getContext('2d')!;
  const scale = Math.min(176 / trimW, 176 / trimH);
  const dw = trimW * scale;
  const dh = trimH * scale;

  octx.save();
  if (opts.flipX) {
    octx.translate(192, 0);
    octx.scale(-1, 1);
  }
  octx.drawImage(work, minX, minY, trimW, trimH, (192 - dw) / 2, (192 - dh) / 2, dw, dh);
  octx.restore();

  const thumb = document.createElement('canvas');
  thumb.width = 64;
  thumb.height = 64;
  const tctx = thumb.getContext('2d')!;
  tctx.drawImage(out, 0, 0, 64, 64);

  return {
    canvas: out,
    thumbUrl: thumb.toDataURL('image/png'),
  };
}

class SpriteAtlasManager {
  private sprites = new Map<SpriteKey, HTMLCanvasElement>();
  private thumbs = new Map<SpriteKey, string>();
  private terrains = new Map<'arid' | 'arctic', HTMLImageElement>();
  private listeners = new Set<() => void>();
  public readyVersion = 0;
  private started = false;

  public init(): void {
    if (this.started || typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }
    this.started = true;
    void this.loadAll();
  }

  private async loadAll(): Promise<void> {
    const tasks: Array<Promise<void>> = [];

    tasks.push(
      loadImage('/assets/buildings-sheet.jpg')
        .then((img) => {
          for (const [key, col, row] of BUILDING_SHEET_MAP) {
            const res = extractCellSprite(img, col, row, { stripBottomLabel: true });
            if (res) {
              this.sprites.set(key, res.canvas);
              this.thumbs.set(key, res.thumbUrl);
            }
          }
        })
        .catch(() => {})
    );

    tasks.push(
      loadImage('/assets/units-sheet.jpg')
        .then((img) => {
          for (const [key, col, row] of UNIT_SHEET_MAP) {
            const res = extractCellSprite(img, col, row, { flipX: key !== 'silicon_node' });
            if (res) {
              this.sprites.set(key, res.canvas);
              this.thumbs.set(key, res.thumbUrl);
            }
          }
        })
        .catch(() => {})
    );

    tasks.push(
      loadImage('/assets/terrain-desert.jpg')
        .then((img) => {
          this.terrains.set('arid', img);
        })
        .catch(() => {})
    );

    tasks.push(
      loadImage('/assets/terrain-arctic.jpg')
        .then((img) => {
          this.terrains.set('arctic', img);
        })
        .catch(() => {})
    );

    await Promise.all(tasks);
    this.readyVersion += 1;
    for (const cb of this.listeners) cb();
  }

  public subscribe(cb: () => void): () => void {
    this.init();
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  public getSprite(key: string): HTMLCanvasElement | undefined {
    this.init();
    return this.sprites.get(key as SpriteKey);
  }

  public getThumbnail(key: string): string | undefined {
    this.init();
    return this.thumbs.get(key as SpriteKey);
  }

  public getTerrainTexture(biome: 'arid' | 'arctic'): HTMLImageElement | undefined {
    this.init();
    return this.terrains.get(biome);
  }
}

export const spriteAtlas = new SpriteAtlasManager();
