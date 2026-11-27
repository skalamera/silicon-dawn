import {
  BUILDING_DEFS,
  CYBER_POWERS,
  UNIT_DEFS,
  type BuildingId,
  type CyberPowerId,
  type FactionId,
  type UnitId,
} from '../data/defs';
import { isBuildingAdjacentToWater } from '../sim/helpers';
import { canPlaceBuilding } from '../sim/pathfinding';
import type { Entity, GameState, OverlayMode } from '../sim/types';
import { spriteAtlas } from './SpriteAtlas';

export interface CameraState {
  x: number;
  y: number;
  zoom: number;
}

export type ArmedTargeting =
  | { kind: 'cyber'; powerId: CyberPowerId }
  | { kind: 'superweapon' }
  | null;

export interface RenderUiOverlay {
  camera: CameraState;
  overlayMode: OverlayMode;
  selectedIds: Set<string>;
  boxSelect: { x1: number; y1: number; x2: number; y2: number } | null;
  hoverTile: { tx: number; ty: number } | null;
  hoverWorld: { wx: number; wy: number } | null;
  attackMoveArmed: boolean;
  armedTargeting: ArmedTargeting;
  colorblindPalette?: boolean;
  lowPowerMode?: boolean;
}

interface FactionPalette {
  primary: string;
  trim: string;
  dark: string;
  glow: string;
}

function getPalette(faction: FactionId, colorblind = false): FactionPalette {
  if (colorblind) {
    if (faction === 'alliance') {
      return { primary: '#0072b2', trim: '#56b4e9', dark: '#082f49', glow: 'rgba(86, 180, 233, 0.75)' };
    }
    if (faction === 'pact') {
      return { primary: '#d55e00', trim: '#fdba74', dark: '#431407', glow: 'rgba(253, 186, 116, 0.75)' };
    }
    if (faction === 'axis') {
      return { primary: '#e69f00', trim: '#f0e442', dark: '#422006', glow: 'rgba(240, 228, 66, 0.75)' };
    }
    return { primary: '#475569', trim: '#cbd5e1', dark: '#1e293b', glow: 'rgba(203, 213, 225, 0.5)' };
  }
  if (faction === 'alliance') {
    return { primary: '#2563eb', trim: '#38bdf8', dark: '#172554', glow: 'rgba(56, 189, 248, 0.7)' };
  }
  if (faction === 'pact') {
    return { primary: '#b91c1c', trim: '#f87171', dark: '#450a0a', glow: 'rgba(248, 113, 113, 0.7)' };
  }
  if (faction === 'axis') {
    return { primary: '#ca8a04', trim: '#facc15', dark: '#422006', glow: 'rgba(250, 204, 21, 0.7)' };
  }
  return { primary: '#475569', trim: '#94a3b8', dark: '#1e293b', glow: 'rgba(148, 163, 184, 0.5)' };
}

export class CanvasRenderer {
  private terrainCache: HTMLCanvasElement | null = null;
  private cachedMapKey = '';

  private ensureTerrainCache(state: GameState): HTMLCanvasElement {
    const mapKey = `${state.map.id}:${state.map.biome}:v${spriteAtlas.readyVersion}`;
    if (this.terrainCache && this.cachedMapKey === mapKey) {
      return this.terrainCache;
    }
    const { width, height, tileSize, tiles, biome } = state.map;
    const off = document.createElement('canvas');
    off.width = width * tileSize;
    off.height = height * tileSize;
    const ctx = off.getContext('2d')!;

    const tex = biome === 'arctic' ? spriteAtlas.getTerrainTexture('arctic') : spriteAtlas.getTerrainTexture('arid');
    const groundPattern = tex ? ctx.createPattern(tex, 'repeat') : null;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const kind = tiles[y * width + x];
        const px = x * tileSize;
        const py = y * tileSize;
        const noise = ((x * 73856093) ^ (y * 19349663)) & 7;

        if (kind === 'water') {
          ctx.fillStyle =
            biome === 'arctic'
              ? noise % 2 === 0
                ? '#0a2b44'
                : '#0c324f'
              : noise % 2 === 0
              ? '#072436'
              : '#08293d';
          ctx.fillRect(px, py, tileSize, tileSize);
          ctx.fillStyle = biome === 'arctic' ? 'rgba(186, 230, 253, 0.16)' : 'rgba(56, 189, 248, 0.1)';
          ctx.fillRect(px + 4, py + ((noise * 4) % 24), tileSize - 10, 2);
          ctx.fillRect(px + 12, py + ((noise * 6 + 10) % 36), tileSize - 22, 1.5);
        } else if (kind === 'concrete') {
          if (biome === 'urban') {
            ctx.fillStyle = noise % 2 === 0 ? '#1b222c' : '#192029';
            ctx.fillRect(px, py, tileSize, tileSize);
            if (x % 3 === 0) {
              ctx.fillStyle = 'rgba(250, 204, 21, 0.14)';
              ctx.fillRect(px + tileSize / 2 - 1, py + 8, 2, tileSize - 16);
            }
          } else if (biome === 'arctic') {
            ctx.fillStyle = noise % 2 === 0 ? '#2b394a' : '#263344';
            ctx.fillRect(px, py, tileSize, tileSize);
          } else {
            ctx.fillStyle = noise % 2 === 0 ? '#27313d' : '#242e39';
            ctx.fillRect(px, py, tileSize, tileSize);
          }
          // Subtle tarmac hazard bevel
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
          ctx.strokeRect(px + 0.5, py + 0.5, tileSize - 1, tileSize - 1);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
          ctx.fillRect(px + 2, py + 2, tileSize - 4, 2);
        } else if (kind === 'ridge') {
          if (groundPattern) {
            ctx.fillStyle = groundPattern;
            ctx.fillRect(px, py, tileSize, tileSize);
            ctx.fillStyle = biome === 'arctic' ? 'rgba(148, 197, 235, 0.2)' : 'rgba(56, 64, 78, 0.42)';
            ctx.fillRect(px, py, tileSize, tileSize);
          } else {
            ctx.fillStyle = biome === 'arctic' ? '#47596e' : '#3b424d';
            ctx.fillRect(px, py, tileSize, tileSize);
          }
          ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
          ctx.fillRect(px, py, tileSize, 4);
        } else if (kind === 'cliff') {
          ctx.fillStyle = '#141922';
          ctx.fillRect(px, py, tileSize, tileSize);
          ctx.fillStyle = biome === 'arctic' ? '#3a4a5e' : '#2d3440';
          ctx.fillRect(px, py, tileSize, tileSize * 0.45);
          ctx.fillStyle = 'rgba(0, 0, 0, 0.52)';
          ctx.fillRect(px, py + tileSize * 0.45, tileSize, tileSize * 0.55);
        } else {
          if (groundPattern && biome !== 'urban') {
            ctx.fillStyle = groundPattern;
            ctx.fillRect(px, py, tileSize, tileSize);
            ctx.fillStyle = biome === 'arctic' ? 'rgba(15, 28, 44, 0.25)' : 'rgba(18, 22, 28, 0.28)';
            ctx.fillRect(px, py, tileSize, tileSize);
          } else {
            const shades =
              biome === 'arctic'
                ? ['#253647', '#293b4d', '#223242', '#2b3e52']
                : ['#262b30', '#282d33', '#23282d', '#2a2f35'];
            ctx.fillStyle = shades[noise % shades.length];
            ctx.fillRect(px, py, tileSize, tileSize);
          }
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.04)';
          ctx.strokeRect(px + 0.5, py + 0.5, tileSize - 1, tileSize - 1);
        }
      }
    }

    this.terrainCache = off;
    this.cachedMapKey = mapKey;
    return off;
  }

  public render(
    canvas: HTMLCanvasElement,
    minimapCanvas: HTMLCanvasElement | null,
    state: GameState,
    ui: RenderUiOverlay,
    animTime: number
  ): void {
    const dpr = ui.lowPowerMode ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const viewW = Math.max(200, Math.round(rect.width));
    const viewH = Math.max(200, Math.round(rect.height));

    if (canvas.width !== Math.round(viewW * dpr) || canvas.height !== Math.round(viewH * dpr)) {
      canvas.width = Math.round(viewW * dpr);
      canvas.height = Math.round(viewH * dpr);
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#060b12';
    ctx.fillRect(0, 0, viewW, viewH);

    const { camera, overlayMode } = ui;
    ctx.save();
    ctx.translate(viewW / 2, viewH / 2);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);

    const terrain = this.ensureTerrainCache(state);
    ctx.drawImage(terrain, 0, 0);

    // Persistent Scorch Craters
    for (const sc of state.scorchMarks) {
      const grad = ctx.createRadialGradient(sc.x, sc.y, 1, sc.x, sc.y, sc.r);
      grad.addColorStop(0, 'rgba(7, 9, 12, 0.65)');
      grad.addColorStop(0.65, 'rgba(15, 18, 24, 0.35)');
      grad.addColorStop(1, 'rgba(15, 18, 24, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(sc.x, sc.y, sc.r, 0, Math.PI * 2);
      ctx.fill();
    }

    if (overlayMode === 'em') {
      ctx.fillStyle = 'rgba(8, 22, 46, 0.44)';
      ctx.fillRect(0, 0, terrain.width, terrain.height);
    } else if (overlayMode === 'power') {
      ctx.fillStyle = 'rgba(7, 26, 28, 0.42)';
      ctx.fillRect(0, 0, terrain.width, terrain.height);
    }

    const p1Fog = state.fog.p1;
    const { width: mapW, height: mapH, tileSize } = state.map;

    const isVisibleToP1 = (wx: number, wy: number, ownerId: string): boolean => {
      if (ownerId === 'p1' || ownerId === 'neutral') return true;
      if (!p1Fog) return true;
      const tx = Math.max(0, Math.min(mapW - 1, Math.floor(wx / tileSize)));
      const ty = Math.max(0, Math.min(mapH - 1, Math.floor(wy / tileSize)));
      return p1Fog[ty * mapW + tx] === 2;
    };

    this.drawLinksAndOverlays(ctx, state, overlayMode, animTime);

    // Human Controller Override Auras & Seismic Sensor Radii
    for (const id of state.entityOrder) {
      const ent = state.entities[id];
      if (!ent || ent.ownerId !== 'p1') continue;
      if (ent.kind === 'unit') {
        const def = UNIT_DEFS[ent.defId as UnitId];
        if (def.auraRadius && (state.players.p1.powerRatio < 1.0 || state.kesslerTimer > 0 || ui.selectedIds.has(ent.id))) {
          ctx.save();
          ctx.strokeStyle = 'rgba(52, 211, 153, 0.72)';
          ctx.lineWidth = 1.6;
          ctx.setLineDash([6, 5]);
          ctx.beginPath();
          ctx.arc(ent.x, ent.y, def.auraRadius, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      } else {
        const sr = BUILDING_DEFS[ent.defId as BuildingId].seismicRadius;
        if (sr && (overlayMode === 'em' || ui.selectedIds.has(ent.id))) {
          ctx.save();
          ctx.strokeStyle = 'rgba(45, 212, 191, 0.45)';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.arc(ent.x, ent.y, (animTime * 90) % sr, 0, Math.PI * 2);
          ctx.stroke();
          ctx.strokeStyle = 'rgba(45, 212, 191, 0.25)';
          ctx.beginPath();
          ctx.arc(ent.x, ent.y, sr, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    // Hexagonal GPS-Denied Jamming Domes
    for (const dome of state.jamDomes) {
      if (!isVisibleToP1(dome.x, dome.y, dome.ownerId) && overlayMode !== 'em') continue;
      this.drawHexJamDome(ctx, dome.x, dome.y, dome.radius, overlayMode === 'em', animTime, Boolean(ui.colorblindPalette));
    }

    // Adversarial Data Poison Zones
    for (const pz of state.poisonZones) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(pz.x, pz.y, pz.radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(190, 24, 93, 0.16)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(244, 114, 182, 0.85)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.fillStyle = '#fbcfe8';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('DATA POISONING', pz.x, pz.y - pz.radius + 16);
      ctx.restore();
    }

    // Buildings
    for (const id of state.entityOrder) {
      const ent = state.entities[id];
      if (!ent || ent.kind !== 'building') continue;
      const tx = Math.floor(ent.x / tileSize);
      const ty = Math.floor(ent.y / tileSize);
      const fogVal = p1Fog ? p1Fog[ty * mapW + tx] : 2;
      if (ent.ownerId !== 'p1' && ent.implantedBy !== 'p1' && fogVal === 0) continue;
      this.drawBuilding(ctx, state, ent, ui.selectedIds.has(ent.id), animTime, Boolean(ui.colorblindPalette));
    }

    // Q-Day Live Enemy Waypoints
    if (state.players.p1.qDayActive) {
      ctx.save();
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.55)';
      ctx.lineWidth = 1.4;
      ctx.setLineDash([5, 5]);
      for (const id of state.entityOrder) {
        const u = state.entities[id];
        if (!u || u.kind !== 'unit' || u.ownerId !== 'ai1' || u.path.length === 0) continue;
        ctx.beginPath();
        ctx.moveTo(u.x, u.y);
        for (const wp of u.path) ctx.lineTo(wp.x, wp.y);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Deepfake Spoof Blips
    for (const blip of state.spoofBlips) {
      if (blip.ownerId === 'p1' || overlayMode === 'em') {
        ctx.save();
        ctx.strokeStyle = '#c084fc';
        ctx.fillStyle = 'rgba(192, 132, 252, 0.35)';
        ctx.beginPath();
        ctx.arc(blip.x, blip.y, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#e9d5ff';
        ctx.fillText('SPOOF', blip.x, blip.y - 13);
        ctx.restore();
      }
    }

    // Rally Point Flag
    const p1 = state.players.p1;
    if (p1?.rallyPoint) {
      ctx.save();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(p1.rallyPoint.x, p1.rallyPoint.y);
      ctx.lineTo(p1.rallyPoint.x, p1.rallyPoint.y - 20);
      ctx.stroke();
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.moveTo(p1.rallyPoint.x, p1.rallyPoint.y - 20);
      ctx.lineTo(p1.rallyPoint.x + 12, p1.rallyPoint.y - 15);
      ctx.lineTo(p1.rallyPoint.x, p1.rallyPoint.y - 10);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Units
    for (const id of state.entityOrder) {
      const ent = state.entities[id];
      if (!ent || ent.kind !== 'unit') continue;
      if (ent.ownerId !== 'p1' && !ent.isRevealed) continue;
      if (!isVisibleToP1(ent.x, ent.y, ent.ownerId)) continue;
      this.drawUnit(ctx, state, ent, ui.selectedIds.has(ent.id), animTime, Boolean(ui.colorblindPalette));
    }

    // Project Prometheus Orbital Beams
    for (const pb of state.prometheusBeams) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(pb.x, pb.y, pb.radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(34, 211, 238, 0.16)';
      ctx.fill();
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 3;
      ctx.stroke();

      const colGrad = ctx.createLinearGradient(pb.x - 28, 0, pb.x + 28, 0);
      colGrad.addColorStop(0, 'rgba(34, 211, 238, 0)');
      colGrad.addColorStop(0.5, 'rgba(224, 242, 254, 0.78)');
      colGrad.addColorStop(1, 'rgba(34, 211, 238, 0)');
      ctx.fillStyle = colGrad;
      ctx.fillRect(pb.x - 28, pb.y - 600, 56, 600);
      ctx.fillStyle = '#e0f2fe';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`PROMETHEUS (${Math.ceil(pb.life)}s)`, pb.x, pb.y - pb.radius - 8);
      ctx.restore();
    }

    // Effects + Additive Bloom Pass
    this.drawEffects(ctx, state, animTime);
    if (!ui.lowPowerMode) {
      this.drawAdditiveBloom(ctx, state, animTime);
    }

    // Fog of War Shading
    if (p1Fog) {
      for (let y = 0; y < mapH; y++) {
        for (let x = 0; x < mapW; x++) {
          const v = p1Fog[y * mapW + x];
          if (v === 2) continue;
          ctx.fillStyle = v === 0 ? 'rgba(4, 8, 14, 0.9)' : 'rgba(6, 11, 20, 0.48)';
          ctx.fillRect(x * tileSize, y * tileSize, tileSize + 0.5, tileSize + 0.5);
        }
      }
    }

    // Building Placement Ghost
    if (p1?.readyBuildingDefId && ui.hoverTile) {
      const def = BUILDING_DEFS[p1.readyBuildingDefId];
      const { tx, ty } = ui.hoverTile;
      const check = canPlaceBuilding(state, 'p1', def.id, tx, ty);
      const px = tx * tileSize;
      const py = ty * tileSize;
      const pw = def.footprintW * tileSize;
      const ph = def.footprintH * tileSize;

      ctx.save();
      ctx.fillStyle = check.ok ? 'rgba(34, 211, 238, 0.24)' : 'rgba(244, 63, 94, 0.28)';
      ctx.strokeStyle = check.ok ? '#38bdf8' : '#f43f5e';
      ctx.lineWidth = 2;
      ctx.fillRect(px, py, pw, ph);
      ctx.strokeRect(px, py, pw, ph);

      const waterCooled =
        def.waterCoolingBonus && isBuildingAdjacentToWater(state, tx, ty, def.footprintW, def.footprintH);
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = check.ok ? '#e0f2fe' : '#fecaca';
      ctx.fillText(
        check.ok ? (waterCooled ? `${def.shortName} (+25% COOLING)` : `DEPLOY ${def.shortName}`) : (check.reason ?? 'BLOCKED'),
        px + pw / 2,
        py - 8
      );
      ctx.restore();
    }

    // Armed Cyber Power / Superweapon AoE Target Reticle
    if (ui.armedTargeting && ui.hoverWorld) {
      const r =
        ui.armedTargeting.kind === 'superweapon'
          ? 175
          : CYBER_POWERS[ui.armedTargeting.powerId].radius || 140;
      const { wx, wy } = ui.hoverWorld;
      ctx.save();
      ctx.strokeStyle = ui.armedTargeting.kind === 'superweapon' ? '#f43f5e' : '#c084fc';
      ctx.fillStyle =
        ui.armedTargeting.kind === 'superweapon'
          ? 'rgba(244, 63, 94, 0.14)'
          : 'rgba(192, 132, 252, 0.14)';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.arc(wx, wy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore(); // end world transform

    if (ui.boxSelect) {
      const { x1, y1, x2, y2 } = ui.boxSelect;
      const rx = Math.min(x1, x2);
      const ry = Math.min(y1, y2);
      const rw = Math.abs(x2 - x1);
      const rh = Math.abs(y2 - y1);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.14)';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeRect(rx, ry, rw, rh);
    }

    ctx.restore();

    if (minimapCanvas) {
      this.renderMinimap(minimapCanvas, state, camera, viewW, viewH, animTime);
    }
  }

  private drawHexJamDome(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    radius: number,
    emMode: boolean,
    animTime: number,
    colorblind = false
  ): void {
    const strokeMain = colorblind
      ? emMode
        ? 'rgba(232, 121, 249, 0.94)'
        : 'rgba(232, 121, 249, 0.42)'
      : emMode
      ? 'rgba(244, 63, 94, 0.92)'
      : 'rgba(244, 63, 94, 0.38)';
    const fillShade = colorblind
      ? emMode
        ? 'rgba(217, 70, 239, 0.16)'
        : 'rgba(217, 70, 239, 0.05)'
      : emMode
      ? 'rgba(244, 63, 94, 0.16)'
      : 'rgba(244, 63, 94, 0.05)';
    const hexLine = colorblind
      ? emMode
        ? 'rgba(240, 171, 252, 0.35)'
        : 'rgba(217, 70, 239, 0.14)'
      : emMode
      ? 'rgba(251, 113, 133, 0.34)'
      : 'rgba(244, 63, 94, 0.14)';

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = fillShade;
    ctx.fill();

    ctx.clip();
    ctx.strokeStyle = hexLine;
    ctx.lineWidth = 1;
    const hexR = 28;
    const hexH = Math.sqrt(3) * hexR;
    for (let gx = cx - radius - hexR; gx <= cx + radius + hexR; gx += hexR * 1.5) {
      const col = Math.round((gx - cx) / (hexR * 1.5));
      const yOff = (col & 1) * (hexH / 2);
      for (let gy = cy - radius - hexH; gy <= cy + radius + hexH; gy += hexH) {
        const hy = gy + yOff;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (Math.PI / 3) * i;
          const px = gx + Math.cos(a) * hexR;
          const py = hy + Math.sin(a) * hexR;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      }
    }
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = strokeMain;
    ctx.lineWidth = emMode ? 2.4 : 1.4;
    ctx.setLineDash([10, 6]);
    ctx.lineDashOffset = -animTime * 28;
    ctx.stroke();
    if (emMode) {
      ctx.fillStyle = colorblind ? '#f5d0fe' : '#fda4af';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('GPS-DENIED EW DOME', cx, cy - radius + 18);
    }
    ctx.restore();
  }

  private drawAdditiveBloom(ctx: CanvasRenderingContext2D, state: GameState, animTime: number): void {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const id of state.entityOrder) {
      const ent = state.entities[id];
      if (!ent || ent.kind !== 'building') continue;
      if (ent.defId === 'smr' || ent.defId === 'cryo_core' || ent.defId === 'silicon_node') {
        const pulse = 0.22 + 0.08 * Math.sin(animTime * 3.5);
        const r = ent.defId === 'silicon_node' ? 44 : 36;
        const g = ctx.createRadialGradient(ent.x, ent.y - 8, 2, ent.x, ent.y - 8, r);
        g.addColorStop(0, `rgba(56, 189, 248, ${pulse})`);
        g.addColorStop(1, 'rgba(56, 189, 248, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(ent.x, ent.y - 8, r, 0, Math.PI * 2);
        ctx.fill();
      } else if (ent.defId === 'server_farm' && state.players[ent.ownerId]?.overclock) {
        const g = ctx.createRadialGradient(ent.x, ent.y, 4, ent.x, ent.y, 48);
        g.addColorStop(0, 'rgba(249, 115, 22, 0.28)');
        g.addColorStop(1, 'rgba(249, 115, 22, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(ent.x, ent.y, 48, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  private drawLinksAndOverlays(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    overlayMode: OverlayMode,
    animTime: number
  ): void {
    for (const id of state.entityOrder) {
      const crawler = state.entities[id];
      if (!crawler || crawler.kind !== 'unit' || !crawler.linkedNodeId || !crawler.linkedHubId) continue;
      const node = state.entities[crawler.linkedNodeId];
      const hub = state.entities[crawler.linkedHubId];
      if (!node || !hub) continue;

      const isP1 = crawler.ownerId === 'p1';
      ctx.save();
      ctx.strokeStyle = isP1 ? 'rgba(34, 211, 238, 0.78)' : 'rgba(248, 113, 113, 0.68)';
      ctx.lineWidth = overlayMode === 'em' ? 2.6 : 1.8;
      ctx.beginPath();
      ctx.moveTo(node.x, node.y);
      ctx.lineTo(crawler.x, crawler.y);
      ctx.lineTo(hub.x, hub.y);
      ctx.stroke();

      const t = (animTime * 0.9) % 1;
      const px = crawler.x + (hub.x - crawler.x) * t;
      const py = crawler.y + (hub.y - crawler.y) * t;
      ctx.fillStyle = isP1 ? '#e0f2fe' : '#fecaca';
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    for (const anchor of state.tetherAnchors) {
      ctx.save();
      ctx.strokeStyle = overlayMode === 'em' ? 'rgba(52, 211, 153, 0.7)' : 'rgba(52, 211, 153, 0.25)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(anchor.x, anchor.y, anchor.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      for (const id of state.entityOrder) {
        const u = state.entities[id];
        if (!u || u.kind !== 'unit' || u.ownerId !== anchor.ownerId || !u.tethered) continue;
        if (Math.hypot(u.x - anchor.x, u.y - anchor.y) <= anchor.radius) {
          ctx.strokeStyle = 'rgba(110, 231, 183, 0.55)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(anchor.x, anchor.y);
          ctx.lineTo(u.x, u.y);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    if (overlayMode === 'power') {
      const p1Buildings = state.entityOrder
        .map((id) => state.entities[id])
        .filter((e) => e && e.kind === 'building' && e.ownerId === 'p1');
      const powerSources = p1Buildings.filter((b) => BUILDING_DEFS[b.defId as BuildingId].powerDelta > 0);
      const powerConsumers = p1Buildings.filter((b) => BUILDING_DEFS[b.defId as BuildingId].powerDelta < 0);
      const serverFarms = p1Buildings.filter((b) => BUILDING_DEFS[b.defId as BuildingId].flopsDelta > 0);

      ctx.save();
      ctx.setLineDash([7, 5]);
      ctx.lineDashOffset = -animTime * 28;
      for (const c of powerConsumers) {
        let bestSrc = powerSources[0];
        let bestD = Infinity;
        for (const s of powerSources) {
          const d = Math.hypot(s.x - c.x, s.y - c.y);
          if (d < bestD) { bestD = d; bestSrc = s; }
        }
        if (bestSrc) {
          ctx.strokeStyle = state.players.p1.powerRatio < 1 ? 'rgba(245, 158, 11, 0.8)' : 'rgba(52, 211, 153, 0.72)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(bestSrc.x, bestSrc.y);
          ctx.lineTo(c.x, c.y);
          ctx.stroke();
        }
      }
      ctx.setLineDash([]);

      for (const id of state.entityOrder) {
        const u = state.entities[id];
        if (!u || u.kind !== 'unit' || u.ownerId !== 'p1') continue;
        if (!UNIT_DEFS[u.defId as UnitId].tags.includes('AUTONOMOUS')) continue;
        const farm = serverFarms[0];
        if (!farm) continue;
        ctx.strokeStyle = state.players.p1.overclock
          ? 'rgba(249, 115, 22, 0.55)'
          : state.players.p1.latencyFactor < 1
          ? 'rgba(245, 158, 11, 0.55)'
          : 'rgba(56, 189, 248, 0.42)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(farm.x, farm.y - 6);
        ctx.lineTo(u.x, u.y);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  private drawBuilding(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    ent: Entity,
    selected: boolean,
    animTime: number,
    colorblind = false
  ): void {
    const def = BUILDING_DEFS[ent.defId as BuildingId];
    const ts = state.map.tileSize;
    const w = def.footprintW * ts - 10;
    const h = def.footprintH * ts - 10;
    const cx = ent.x;
    const cy = ent.y;
    const owner = state.players[ent.ownerId];
    const pal = getPalette(owner?.faction ?? 'neutral', colorblind);

    ctx.save();

    if (def.isResourceNode) {
      const nodeSprite = spriteAtlas.getSprite('silicon_node');
      ctx.fillStyle = 'rgba(0,0,0,0.42)';
      ctx.beginPath();
      ctx.ellipse(cx + 4, cy + 6, w * 0.44, h * 0.36, 0, 0, Math.PI * 2);
      ctx.fill();
      if (nodeSprite) {
        ctx.drawImage(nodeSprite, cx - w * 0.56, cy - h * 0.58, w * 1.12, h * 1.12);
      } else {
        for (let i = 0; i < 6; i++) {
          const ang = (i / 6) * Math.PI * 2 + 0.3;
          const rx = cx + Math.cos(ang) * 18;
          const ry = cy + Math.sin(ang) * 13;
          const ch = 14 + (i % 3) * 6;
          ctx.fillStyle = '#0891b2';
          ctx.fillRect(rx - 6, ry - ch, 12, ch);
          ctx.fillStyle = '#67e8f9';
          ctx.beginPath();
          ctx.moveTo(rx - 6, ry - ch);
          ctx.lineTo(rx, ry - ch - 7);
          ctx.lineTo(rx + 6, ry - ch);
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.fillStyle = '#cffafe';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`Si ${Math.round(ent.siliconRemaining ?? 0)}`, cx, cy + h * 0.48);
      ctx.restore();
      return;
    }

    if (def.isPopupSilo && ent.siloOpenTimer <= 0) {
      ctx.fillStyle = '#2b3440';
      ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
      ctx.strokeStyle = ent.ownerId === 'p1' ? pal.trim : '#475569';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(cx - w / 2, cy - h / 2, w, h);
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(cx - 8, cy - 8, 16, 16);
      ctx.restore();
      return;
    }

    const depth = ent.defId === 'conyard' || def.isSuperweapon ? 18 : ent.defId === 'smr' ? 20 : 14;
    const x0 = cx - w / 2;
    const y0 = cy - h / 2;

    if (def.isDecoy && ent.ownerId === 'p1') {
      ctx.globalAlpha = 0.72 + 0.18 * Math.sin(animTime * 6);
    }

    const bldSprite = spriteAtlas.getSprite(ent.defId);
    if (bldSprite) {
      // Soft directional shadow + faction base perimeter pad
      ctx.fillStyle = 'rgba(2, 6, 12, 0.5)';
      ctx.beginPath();
      ctx.ellipse(cx + 6, cy + h * 0.14, w * 0.54, h * 0.44, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = selected ? '#38bdf8' : pal.trim;
      ctx.lineWidth = selected ? 2.4 : 1.3;
      ctx.strokeRect(x0, y0, w, h);

      const drawSize = Math.max(w, h) * 1.18;
      ctx.drawImage(bldSprite, cx - drawSize / 2, cy - drawSize / 2 - 6, drawSize, drawSize);

      if (ent.defId === 'server_farm' && ent.implantedBy === 'p1') {
        ctx.fillStyle = '#d8b4fe';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('ZERO-DAY', cx, y0 - 16);
      }
      if (ent.defId === 'server_farm' && owner?.overclock) {
        ctx.strokeStyle = 'rgba(249, 115, 22, 0.85)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x0 - 3, y0 - 3, w + 6, h + 6);
      }
    } else {
      ctx.fillStyle = 'rgba(3, 6, 12, 0.48)';
      ctx.fillRect(x0 + 8, y0 + 9, w, h);

      ctx.fillStyle = pal.dark;
      ctx.fillRect(x0, y0 + h - depth * 0.4, w, depth * 0.6);

      ctx.fillStyle = '#1e293b';
      ctx.fillRect(x0, y0 - depth * 0.5, w, h - depth * 0.1);
      ctx.strokeStyle = selected ? '#38bdf8' : pal.trim;
      ctx.lineWidth = selected ? 2.4 : 1.3;
      ctx.strokeRect(x0, y0 - depth * 0.5, w, h - depth * 0.1);

      ctx.fillStyle = pal.primary;
      ctx.fillRect(x0 + 4, y0 - depth * 0.5 + 4, w - 8, 7);
    }

    if (ent.defId === 'smr') {
      const pulse = 0.65 + 0.35 * Math.sin(animTime * 4);
      ctx.fillStyle = `rgba(56, 189, 248, ${pulse})`;
      ctx.beginPath();
      ctx.arc(cx, cy - depth * 0.4, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e0f2fe';
      ctx.beginPath();
      ctx.arc(cx, cy - depth * 0.4, 6, 0, Math.PI * 2);
      ctx.fill();
    } else if (ent.defId === 'server_farm') {
      const ledColor = ent.implantedBy ? '#a855f7' : owner?.overclock ? '#f97316' : '#22d3ee';
      for (let r = -22; r <= 22; r += 11) {
        const on = Math.floor(animTime * 6 + r) % 2 === 0;
        ctx.fillStyle = on ? ledColor : '#0f172a';
        ctx.fillRect(cx + r - 3, cy - depth * 0.4 - 6, 6, 16);
      }
      if (ent.implantedBy === 'p1') {
        ctx.fillStyle = '#d8b4fe';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('ZERO-DAY', cx, y0 - 16);
      }
    } else if (ent.defId === 'cryo_core') {
      ctx.strokeStyle = '#67e8f9';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy - depth * 0.4, 14 + Math.sin(animTime * 3) * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#cffafe';
      ctx.beginPath();
      ctx.arc(cx, cy - depth * 0.4, 7, 0, Math.PI * 2);
      ctx.fill();
    } else if (def.isSuperweapon) {
      ctx.fillStyle = pal.trim;
      ctx.beginPath();
      ctx.arc(cx, cy - depth * 0.4, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.floor(owner?.superweaponCharge ?? 0)}%`, cx, cy - depth * 0.4 + 3);
    } else if (ent.defId === 'iron_beam' || ent.defId === 'hpm_tower' || ent.defId === 'popup_silo') {
      ctx.save();
      ctx.translate(cx, cy - depth * 0.4);
      ctx.rotate(ent.turretAngle);
      ctx.fillStyle = ent.defId === 'iron_beam' ? '#e0f2fe' : ent.defId === 'hpm_tower' ? '#fca5a5' : '#fde047';
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(4, -3, 14, 6);
      ctx.restore();
    } else if (ent.defId === 'lng_terminal') {
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(cx - 14, cy - 4, 10, 0, Math.PI * 2);
      ctx.arc(cx + 14, cy - 4, 10, 0, Math.PI * 2);
      ctx.fill();
    } else if (ent.defId === 'fiber_station') {
      ctx.fillStyle = '#06b6d4';
      ctx.fillRect(cx - 18, cy - 12, 36, 12);
      ctx.fillStyle = '#cffafe';
      ctx.beginPath();
      ctx.arc(cx, cy - 6, 6, 0, Math.PI * 2);
      ctx.fill();
    } else if (ent.defId === 'analog_radar') {
      const rAng = animTime * 1.8;
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(cx - Math.cos(rAng) * 16, cy - 8 - Math.sin(rAng) * 10);
      ctx.lineTo(cx + Math.cos(rAng) * 16, cy - 8 + Math.sin(rAng) * 10);
      ctx.stroke();
      ctx.fillStyle = '#fde68a';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('ANALOG', cx, y0 + h + 10);
    }

    if (def.isNeutralCapture && ent.ownerId === 'neutral' && (ent.captureProgress ?? 0) > 0) {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(cx - 24, y0 - 16, 48, 5);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(cx - 24, y0 - 16, 48 * (ent.captureProgress ?? 0), 5);
    }

    if (ent.poisonTimer > 0) {
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 2;
      ctx.strokeRect(x0 - 3, y0 - depth * 0.5 - 3, w + 6, h + 6);
    }

    if (ent.waterCooled) {
      ctx.fillStyle = '#06b6d4';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('H2O +25%', cx, y0 + h + 10);
    }

    if (ent.repairing) {
      ctx.save();
      ctx.strokeStyle = `rgba(52, 211, 153, ${0.55 + Math.sin(animTime * 8) * 0.3})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.strokeRect(x0 - 2, y0 - depth * 0.5 - 2, w + 4, h + 4);
      ctx.fillStyle = '#34d399';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('+', cx + Math.min(32, w * 0.5) + 7, y0 - depth * 0.5 - 5);
      ctx.restore();
    }

    if (selected || ent.hp < ent.maxHp) {
      this.drawHealthBar(ctx, cx, y0 - depth * 0.5 - 10, Math.min(64, w), ent.hp / ent.maxHp, pal.trim);
    }

    if (ent.veterancy > 0) {
      ctx.fillStyle = ent.veterancy === 3 ? '#fb7185' : '#facc15';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('★'.repeat(ent.veterancy), cx, y0 - depth * 0.5 - 16);
    }

    ctx.restore();
  }

  private drawUnit(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    ent: Entity,
    selected: boolean,
    animTime: number,
    colorblind = false
  ): void {
    const def = UNIT_DEFS[ent.defId as UnitId];
    const owner = state.players[ent.ownerId];
    const pal = getPalette(owner?.faction ?? 'alliance', colorblind);

    if (ent.burrowed) {
      ctx.save();
      ctx.translate(ent.x, ent.y);
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.85)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, 14 + Math.sin(animTime * 6) * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('TUNNELING', 0, -18);
      ctx.restore();
      return;
    }

    const isAir = def.tags.includes('AIR');
    const isNaval = def.tags.includes('NAVAL');
    const isTank = def.tags.includes('ARMORED') && def.id !== 'shock_trooper';
    const isInfantry =
      def.id === 'forward_controller' ||
      def.id === 'valkyrie' ||
      def.id === 'shock_trooper' ||
      def.id === 'unit_8200' ||
      def.id === 'ew_sapper' ||
      def.id === 'teleop_militia';
    const isQuad = def.id === 'wolf_pack' || def.id === 'ied_crawler';

    ctx.save();
    ctx.translate(ent.x, ent.y);
    if (def.tags.includes('STEALTH')) {
      ctx.globalAlpha = 0.72;
    }

    if (ent.veterancy === 3) {
      ctx.strokeStyle = `rgba(250, 204, 21, ${0.5 + Math.sin(animTime * 6) * 0.25})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(0, 2, isTank ? 23 : 16, isTank ? 17 : 12, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (ent.repairing) {
      ctx.strokeStyle = `rgba(52, 211, 153, ${0.55 + Math.sin(animTime * 8) * 0.3})`;
      ctx.lineWidth = 1.4;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.ellipse(0, 2, isTank ? 21 : 14, isTank ? 15 : 10, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (selected) {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(0, 2, isTank ? 20 : 13, isTank ? 14 : 9, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (isNaval) {
      ctx.strokeStyle = 'rgba(125, 211, 252, 0.45)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(0, 2, 22, 12, ent.angle, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(0, 0, 0, 0.44)';
    ctx.beginPath();
    ctx.ellipse(isAir ? 6 : 3, isAir ? 16 : 5, isTank ? 17 : 9, isTank ? 11 : 6, 0, 0, Math.PI * 2);
    ctx.fill();

    const unitSprite = spriteAtlas.getSprite(ent.defId);
    if (unitSprite) {
      // Subtle faction ownership ring underneath 2.5D PBR sprite
      ctx.strokeStyle = pal.trim;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(0, 2, isAir ? 14 : 16, isAir ? 9 : 10, 0, 0, Math.PI * 2);
      ctx.stroke();

      const size = isAir ? 42 : isTank ? 46 : 40;
      ctx.save();
      if (isAir) ctx.translate(0, -10);
      if (Math.cos(ent.angle) < 0) ctx.scale(-1, 1);
      ctx.drawImage(unitSprite, -size / 2, -size / 2 - 2, size, size);
      ctx.restore();
    } else if (isAir) {
      ctx.save();
      ctx.translate(0, -10);
      ctx.rotate(ent.angle);
      ctx.fillStyle = def.id === 'loyal_wingman' ? '#38bdf8' : pal.trim;
      ctx.beginPath();
      ctx.moveTo(11, 0);
      ctx.lineTo(-8, 8);
      ctx.lineTo(-4, 0);
      ctx.lineTo(-8, -8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else if (isInfantry) {
      ctx.fillStyle = pal.dark;
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = def.tags.includes('HUMAN') ? '#34d399' : pal.trim;
      ctx.beginPath();
      ctx.arc(0, -2, 4.2, 0, Math.PI * 2);
      ctx.fill();
      if (def.weaponType !== 'none') {
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(0, -1);
        ctx.lineTo(Math.cos(ent.turretAngle) * 10, Math.sin(ent.turretAngle) * 10 - 1);
        ctx.stroke();
      }
    } else if (isQuad) {
      ctx.save();
      ctx.rotate(ent.angle);
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-7, -6, 14, 12);
      ctx.fillStyle = pal.primary;
      ctx.fillRect(-6, -4, 12, 8);
      ctx.fillStyle = pal.trim;
      ctx.fillRect(3, -2, 4, 4);
      ctx.restore();
    } else {
      const hw = def.id === 'mcv' || isNaval ? 16 : 13;
      const hh = def.id === 'mcv' ? 11 : 9;
      ctx.save();
      ctx.rotate(ent.angle);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-hw - 1, -hh - 2, hw * 2 + 2, 4);
      ctx.fillRect(-hw - 1, hh - 2, hw * 2 + 2, 4);
      ctx.fillStyle = pal.dark;
      ctx.fillRect(-hw, -hh, hw * 2, hh * 2);
      ctx.fillStyle = pal.primary;
      ctx.fillRect(-hw + 1, -hh - 2, hw * 2 - 2, hh * 2 - 1);
      ctx.fillStyle = pal.trim;
      ctx.fillRect(-hw + 2, -hh - 1, 4, hh * 2 - 3);
      ctx.restore();

      if (def.weaponType !== 'none') {
        ctx.save();
        ctx.translate(0, -3);
        ctx.rotate(ent.turretAngle);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(4, -1.8, 15, 3.6);
        ctx.fillStyle = pal.trim;
        ctx.fillRect(16, -2, 3, 4);
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.arc(0, 0, 6.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (def.jamRadius) {
        const rAng = animTime * 2.8;
        ctx.strokeStyle = '#fecaca';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(-Math.cos(rAng) * 9, -5 - Math.sin(rAng) * 5);
        ctx.lineTo(Math.cos(rAng) * 9, -5 + Math.sin(rAng) * 5);
        ctx.stroke();
      }
    }

    if (def.hasTrophyAps && !ent.safeMode) {
      if (ent.apsCooldown <= 0) {
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.45)';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(0, -1, 21, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (def.hasSpotterDrone) {
        const dx = 16;
        const dy = -22 + Math.sin(animTime * 4 + ent.x) * 2.5;
        ctx.strokeStyle = 'rgba(125, 211, 252, 0.55)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, -3);
        ctx.lineTo(dx, dy);
        ctx.stroke();
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(dx, dy, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (ent.poisonTimer > 0) {
      ctx.fillStyle = '#e11d48';
      ctx.fillRect(-20, -25, 40, 10);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 7px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('POISONED', 0, -17.5);
    } else if (ent.safeMode) {
      ctx.fillStyle = 'rgba(245, 158, 11, 0.94)';
      ctx.fillRect(-23, -24, 46, 10);
      ctx.fillStyle = '#090d16';
      ctx.font = 'bold 7px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(ent.empStunTimer > 0 ? 'EMP STUN' : 'SAFE MODE', 0, -16.5);
    } else if (ent.tethered) {
      ctx.fillStyle = 'rgba(16, 185, 129, 0.85)';
      ctx.fillRect(-20, -24, 40, 9);
      ctx.fillStyle = '#022c22';
      ctx.font = 'bold 6.5px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('TETHERED', 0, -17);
    } else if (ent.jammed) {
      ctx.fillStyle = 'rgba(244, 63, 94, 0.9)';
      ctx.fillRect(-18, -24, 36, 10);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 7px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('JAMMED', 0, -16.5);
    }

    if (ent.conversionProgress > 0) {
      ctx.fillStyle = '#22d3ee';
      ctx.fillRect(-15, 12, 30 * (ent.conversionProgress / 100), 3);
    }

    if (selected || ent.hp < ent.maxHp) {
      this.drawHealthBar(ctx, 0, -16, 26, ent.hp / ent.maxHp, pal.trim);
    }
    if (ent.repairing) {
      ctx.fillStyle = '#34d399';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('+', 18, -11);
    }
    if (ent.veterancy > 0) {
      const stars = '★'.repeat(ent.veterancy);
      ctx.fillStyle = 'rgba(2, 6, 14, 0.72)';
      ctx.fillRect(-14, 11, 28, 9);
      ctx.fillStyle = ent.veterancy === 3 ? '#fde047' : '#facc15';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(stars, 0, 18);
    }

    ctx.restore();
  }

  private drawHealthBar(
    ctx: CanvasRenderingContext2D,
    cx: number,
    y: number,
    width: number,
    ratio: number,
    accent: string
  ): void {
    const clamped = Math.max(0, Math.min(1, ratio));
    ctx.fillStyle = 'rgba(2, 6, 14, 0.85)';
    ctx.fillRect(cx - width / 2, y, width, 4);
    ctx.fillStyle = clamped > 0.5 ? '#22c55e' : clamped > 0.25 ? '#f59e0b' : '#ef4444';
    ctx.fillRect(cx - width / 2 + 0.5, y + 0.5, (width - 1) * clamped, 3);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 0.5;
    ctx.strokeRect(cx - width / 2, y, width, 4);
  }

  private drawEffects(ctx: CanvasRenderingContext2D, state: GameState, animTime: number): void {
    for (const c of state.smokeClouds) {
      const fade = Math.min(1, c.life * 0.5) * 0.56;
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2 + animTime * 0.3;
        const px = c.x + Math.cos(ang) * (c.radius * 0.38);
        const py = c.y + Math.sin(ang) * (c.radius * 0.35);
        const grd = ctx.createRadialGradient(px, py, 4, px, py, c.radius * 0.65);
        grd.addColorStop(0, `rgba(203, 213, 225, ${fade})`);
        grd.addColorStop(1, 'rgba(148, 163, 184, 0)');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(px, py, c.radius * 0.65, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('AEROSOL SMOKE (-80% HEL)', c.x, c.y - c.radius * 0.55);
    }

    for (const b of state.beams) {
      const alpha = b.life / b.maxLife;
      ctx.save();
      ctx.globalAlpha = alpha;
      if (b.kind === 'laser_hel') {
        ctx.strokeStyle = b.scatteredBySmoke ? 'rgba(125, 211, 252, 0.35)' : 'rgba(34, 211, 238, 0.55)';
        ctx.lineWidth = b.scatteredBySmoke ? 10 : 6;
        ctx.beginPath();
        ctx.moveTo(b.x1, b.y1);
        ctx.lineTo(b.x2, b.y2);
        ctx.stroke();

        ctx.strokeStyle = b.scatteredBySmoke ? '#bae6fd' : '#ffffff';
        ctx.lineWidth = b.scatteredBySmoke ? 1.5 : 2.6;
        ctx.beginPath();
        ctx.moveTo(b.x1, b.y1);
        ctx.lineTo(b.x2, b.y2);
        ctx.stroke();
      } else if (b.kind === 'hpm_cone') {
        const ang = Math.atan2(b.y2 - b.y1, b.x2 - b.x1);
        const dist = Math.hypot(b.x2 - b.x1, b.y2 - b.y1);
        ctx.fillStyle = 'rgba(244, 63, 94, 0.22)';
        ctx.strokeStyle = '#fda4af';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(b.x1, b.y1);
        ctx.arc(b.x1, b.y1, dist, ang - 0.55, ang + 0.55);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (b.kind === 'weld') {
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(b.x1, b.y1);
        ctx.lineTo(b.x2, b.y2);
        ctx.stroke();
      } else if (b.kind === 'aps_intercept') {
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(b.x1, b.y1);
        ctx.lineTo(b.x2, b.y2);
        ctx.stroke();
        ctx.fillStyle = '#e0f2fe';
        ctx.font = 'bold 9px monospace';
        ctx.fillText('APS!', b.x2, b.y2 - 6);
      }
      ctx.restore();
    }

    for (const p of state.projectiles) {
      ctx.fillStyle =
        p.weaponType === 'thermobaric'
          ? '#f97316'
          : p.weaponType === 'cannon'
          ? '#fb923c'
          : p.isRocket || p.weaponType === 'fpv'
          ? '#f43f5e'
          : '#fef08a';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.weaponType === 'thermobaric' ? 4.2 : p.weaponType === 'cannon' ? 3.2 : 2.1, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const ex of state.explosions) {
      const progress = 1 - ex.life / ex.maxLife;
      ctx.save();
      ctx.globalAlpha = ex.life / ex.maxLife;
      ctx.strokeStyle = ex.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(ex.x, ex.y, ex.radius * (0.35 + progress * 0.75), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  private renderMinimap(
    mmCanvas: HTMLCanvasElement,
    state: GameState,
    camera: CameraState,
    viewW: number,
    viewH: number,
    animTime: number
  ): void {
    const ctx = mmCanvas.getContext('2d');
    if (!ctx) return;
    const mw = mmCanvas.width;
    const mh = mmCanvas.height;
    const worldW = state.map.width * state.map.tileSize;
    const worldH = state.map.height * state.map.tileSize;

    ctx.fillStyle = '#070d16';
    ctx.fillRect(0, 0, mw, mh);

    if (state.kesslerTimer > 0) {
      for (let i = 0; i < 120; i++) {
        const rx = ((Math.sin(i * 12.9898 + animTime * 19) * 43758.5453) % 1 + 1) % 1;
        const ry = ((Math.cos(i * 78.233 + animTime * 13) * 19341.123) % 1 + 1) % 1;
        ctx.fillStyle = i % 2 === 0 ? 'rgba(148, 163, 184, 0.35)' : 'rgba(56, 189, 248, 0.25)';
        ctx.fillRect(rx * mw, ry * mh, 4, 2);
      }
      ctx.fillStyle = '#f87171';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('SAT RECON OFFLINE', mw / 2, mh / 2);
      return;
    }

    const sx = mw / state.map.width;
    const sy = mh / state.map.height;
    for (let y = 0; y < state.map.height; y++) {
      for (let x = 0; x < state.map.width; x++) {
        const k = state.map.tiles[y * state.map.width + x];
        if (k === 'water') ctx.fillStyle = '#082c42';
        else if (k === 'ridge' || k === 'cliff') ctx.fillStyle = '#334155';
        else if (k === 'concrete') ctx.fillStyle = '#1e293b';
        else continue;
        ctx.fillRect(x * sx, y * sy, sx + 0.4, sy + 0.4);
      }
    }

    for (const d of state.jamDomes) {
      ctx.fillStyle = 'rgba(244, 63, 94, 0.25)';
      ctx.beginPath();
      ctx.arc((d.x / worldW) * mw, (d.y / worldH) * mh, (d.radius / worldW) * mw, 0, Math.PI * 2);
      ctx.fill();
    }

    const p1Fog = state.fog.p1;
    for (const id of state.entityOrder) {
      const e = state.entities[id];
      if (!e) continue;
      if (e.ownerId !== 'p1' && !e.isRevealed) continue;
      const tx = Math.max(0, Math.min(state.map.width - 1, Math.floor(e.x / state.map.tileSize)));
      const ty = Math.max(0, Math.min(state.map.height - 1, Math.floor(e.y / state.map.tileSize)));
      if (e.ownerId !== 'p1' && e.ownerId !== 'neutral' && p1Fog && p1Fog[ty * state.map.width + tx] !== 2) {
        continue;
      }
      ctx.fillStyle =
        e.ownerId === 'p1'
          ? '#38bdf8'
          : e.ownerId === 'neutral'
          ? e.defId === 'silicon_node'
            ? '#22d3ee'
            : '#f59e0b'
          : '#f87171';
      const size = e.kind === 'building' ? 4 : 2.5;
      ctx.fillRect((e.x / worldW) * mw - size / 2, (e.y / worldH) * mh - size / 2, size, size);
    }

    if (p1Fog) {
      for (let y = 0; y < state.map.height; y++) {
        for (let x = 0; x < state.map.width; x++) {
          if (p1Fog[y * state.map.width + x] === 0) {
            ctx.fillStyle = 'rgba(4, 7, 13, 0.85)';
            ctx.fillRect(x * sx, y * sy, sx + 0.5, sy + 0.5);
          }
        }
      }
    }

    const camW = (viewW / camera.zoom / worldW) * mw;
    const camH = (viewH / camera.zoom / worldH) * mh;
    const camX = (camera.x / worldW) * mw - camW / 2;
    const camY = (camera.y / worldH) * mh - camH / 2;
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.strokeRect(camX, camY, camW, camH);
  }
}
