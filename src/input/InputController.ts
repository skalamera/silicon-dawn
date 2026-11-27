import { BUILDING_DEFS, UNIT_DEFS, type BuildingId, type UnitId } from '../data/defs';
import type { ArmedTargeting, CameraState } from '../renderer/CanvasRenderer';
import type { Entity, GameState, SimCommand } from '../sim/types';

export interface InputCallbacks {
  getState: () => GameState;
  dispatch: (cmd: SimCommand) => void;
  onSelectionChange: (ids: Set<string>) => void;
  onBoxSelectChange: (box: { x1: number; y1: number; x2: number; y2: number } | null) => void;
  onHoverTileChange: (tile: { tx: number; ty: number } | null) => void;
  onHoverWorldChange: (world: { wx: number; wy: number } | null) => void;
  onCycleOverlay: () => void;
  onTogglePause: () => void;
  onQuickSave: () => void;
  onQuickLoad: () => void;
  getAttackMoveArmed: () => boolean;
  clearAttackMoveArmed: () => void;
  getArmedTargeting: () => ArmedTargeting;
  clearArmedTargeting: () => void;
  getBoxSelectMode: () => boolean;
  getTouchRadialEnabled?: () => boolean;
  onOpenRadialMenu?: (pos: { sx: number; sy: number; wx: number; wy: number }) => void;
}

export class InputController {
  public camera: CameraState;
  public selectedIds = new Set<string>();
  private controlGroups = new Map<number, string[]>();
  private keys = new Set<string>();
  private activePointers = new Map<number, { x: number; y: number }>();
  private dragStart: { x: number; y: number; button: number } | null = null;
  private isDraggingBox = false;
  private isPanning = false;
  private lastPanPoint: { x: number; y: number } | null = null;
  private lastPinchDist: number | null = null;
  private lastClickTime = 0;
  private longPressTimer: number | null = null;
  private longPressTriggered = false;

  constructor(
    private canvas: HTMLCanvasElement,
    private cb: InputCallbacks,
    initialCam: CameraState
  ) {
    this.camera = { ...initialCam };
  }

  public attach(): () => void {
    const onPointerDown = (e: PointerEvent) => this.handlePointerDown(e);
    const onPointerMove = (e: PointerEvent) => this.handlePointerMove(e);
    const onPointerUp = (e: PointerEvent) => this.handlePointerUp(e);
    const onWheel = (e: WheelEvent) => this.handleWheel(e);
    const onContextMenu = (e: MouseEvent) => e.preventDefault();
    const onKeyDown = (e: KeyboardEvent) => this.handleKeyDown(e);
    const onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.code);

    this.canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    this.canvas.addEventListener('wheel', onWheel, { passive: false });
    this.canvas.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    return () => {
      this.canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      this.canvas.removeEventListener('wheel', onWheel);
      this.canvas.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }

  public updateCamera(dt: number): void {
    const panSpeed = 560 / this.camera.zoom;
    let dx = 0;
    let dy = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) dx -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) dx += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) dy -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) dy += 1;
    if (dx !== 0 || dy !== 0) {
      this.camera.x += dx * panSpeed * dt;
      this.camera.y += dy * panSpeed * dt;
      this.clampCamera();
    }
  }

  public setCameraCenter(wx: number, wy: number, zoom?: number): void {
    this.camera.x = wx;
    this.camera.y = wy;
    if (typeof zoom === 'number') {
      this.camera.zoom = zoom;
    }
    this.clampCamera();
  }

  public setSelection(ids: string[]): void {
    this.selectedIds = new Set(ids);
    this.cb.onSelectionChange(new Set(this.selectedIds));
  }

  private clampCamera(): void {
    const state = this.cb.getState();
    const maxW = state.map.width * state.map.tileSize;
    const maxH = state.map.height * state.map.tileSize;
    this.camera.x = Math.max(120, Math.min(maxW - 120, this.camera.x));
    this.camera.y = Math.max(120, Math.min(maxH - 120, this.camera.y));
    this.camera.zoom = Math.max(0.45, Math.min(1.85, this.camera.zoom));
  }

  private screenToWorld(clientX: number, clientY: number): { wx: number; wy: number; sx: number; sy: number } {
    const rect = this.canvas.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    const wx = (sx - rect.width / 2) / this.camera.zoom + this.camera.x;
    const wy = (sy - rect.height / 2) / this.camera.zoom + this.camera.y;
    return { wx, wy, sx, sy };
  }

  private pickEntityAt(state: GameState, wx: number, wy: number): Entity | null {
    let best: Entity | null = null;
    let bestD = Infinity;
    for (const id of state.entityOrder) {
      const e = state.entities[id];
      if (!e) continue;
      if (e.ownerId !== 'p1' && !e.isRevealed) continue;
      const hitR = e.kind === 'unit' ? 20 : 34;
      const d = Math.hypot(e.x - wx, e.y - wy);
      if (d <= hitR) {
        const weighted = d + (e.kind === 'building' ? 20 : 0);
        if (weighted < bestD) {
          bestD = weighted;
          best = e;
        }
      }
    }
    return best;
  }

  private handlePointerDown(e: PointerEvent): void {
    this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (this.activePointers.size === 2) {
      if (this.longPressTimer !== null) {
        window.clearTimeout(this.longPressTimer);
        this.longPressTimer = null;
      }
      const pts = Array.from(this.activePointers.values());
      this.lastPinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      this.isDraggingBox = false;
      this.cb.onBoxSelectChange(null);
      return;
    }

    const { wx, wy, sx, sy } = this.screenToWorld(e.clientX, e.clientY);
    const state = this.cb.getState();

    if (e.button === 2) {
      if (this.cb.getArmedTargeting()) {
        this.cb.clearArmedTargeting();
        return;
      }
      if (state.players.p1.readyBuildingDefId) {
        this.cb.dispatch({ type: 'cancelBuildBuilding', playerId: 'p1' });
        return;
      }
      this.issueContextOrder(state, wx, wy);
      return;
    }

    if (e.button === 1) {
      this.isPanning = true;
      this.lastPanPoint = { x: e.clientX, y: e.clientY };
      return;
    }

    this.dragStart = { x: sx, y: sy, button: e.button };
    this.lastPanPoint = { x: e.clientX, y: e.clientY };
    this.isDraggingBox = false;
    this.isPanning = false;
    this.longPressTriggered = false;

    if (this.longPressTimer !== null) {
      window.clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }

    if (
      e.pointerType === 'touch' &&
      this.activePointers.size === 1 &&
      this.selectedIds.size > 0 &&
      this.cb.getTouchRadialEnabled?.() &&
      this.cb.onOpenRadialMenu
    ) {
      const clientX = e.clientX;
      const clientY = e.clientY;
      this.longPressTimer = window.setTimeout(() => {
        this.longPressTriggered = true;
        this.dragStart = null;
        this.cb.onOpenRadialMenu?.({ sx: clientX, sy: clientY, wx, wy });
      }, 420);
    }
  }

  private handlePointerMove(e: PointerEvent): void {
    if (this.activePointers.has(e.pointerId)) {
      this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    if (this.activePointers.size === 2) {
      if (this.longPressTimer !== null) {
        window.clearTimeout(this.longPressTimer);
        this.longPressTimer = null;
      }
      const pts = Array.from(this.activePointers.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (this.lastPinchDist && dist > 10) {
        this.camera.zoom *= dist / this.lastPinchDist;
        this.clampCamera();
      }
      this.lastPinchDist = dist;
      return;
    }

    const state = this.cb.getState();
    const { wx, wy, sx, sy } = this.screenToWorld(e.clientX, e.clientY);
    const tx = Math.floor(wx / state.map.tileSize);
    const ty = Math.floor(wy / state.map.tileSize);
    this.cb.onHoverTileChange({ tx, ty });
    this.cb.onHoverWorldChange({ wx, wy });

    if (this.isPanning && this.lastPanPoint) {
      const dx = e.clientX - this.lastPanPoint.x;
      const dy = e.clientY - this.lastPanPoint.y;
      this.camera.x -= dx / this.camera.zoom;
      this.camera.y -= dy / this.camera.zoom;
      this.clampCamera();
      this.lastPanPoint = { x: e.clientX, y: e.clientY };
      return;
    }

    if (this.dragStart && e.pointerType === 'touch' && !this.cb.getBoxSelectMode()) {
      const dist = Math.hypot(sx - this.dragStart.x, sy - this.dragStart.y);
      if (dist > 10 && this.longPressTimer !== null) {
        window.clearTimeout(this.longPressTimer);
        this.longPressTimer = null;
      }
      if (dist > 8 && this.lastPanPoint) {
        this.isPanning = true;
        const dx = e.clientX - this.lastPanPoint.x;
        const dy = e.clientY - this.lastPanPoint.y;
        this.camera.x -= dx / this.camera.zoom;
        this.camera.y -= dy / this.camera.zoom;
        this.clampCamera();
      }
      this.lastPanPoint = { x: e.clientX, y: e.clientY };
      return;
    }

    if (this.dragStart && (e.pointerType !== 'touch' || this.cb.getBoxSelectMode())) {
      const dist = Math.hypot(sx - this.dragStart.x, sy - this.dragStart.y);
      if (dist > 7) {
        this.isDraggingBox = true;
        this.cb.onBoxSelectChange({
          x1: this.dragStart.x,
          y1: this.dragStart.y,
          x2: sx,
          y2: sy,
        });
      }
    }
  }

  private handlePointerUp(e: PointerEvent): void {
    if (this.longPressTimer !== null) {
      window.clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    this.activePointers.delete(e.pointerId);
    if (this.activePointers.size < 2) {
      this.lastPinchDist = null;
    }
    if (this.longPressTriggered) {
      this.longPressTriggered = false;
      return;
    }

    if (e.button === 1 || this.isPanning) {
      this.isPanning = false;
      this.dragStart = null;
      this.lastPanPoint = null;
      return;
    }

    if (!this.dragStart) return;

    const state = this.cb.getState();
    const { wx, wy, sx, sy } = this.screenToWorld(e.clientX, e.clientY);

    if (this.isDraggingBox) {
      const rect = this.canvas.getBoundingClientRect();
      const xMin = Math.min(this.dragStart.x, sx);
      const xMax = Math.max(this.dragStart.x, sx);
      const yMin = Math.min(this.dragStart.y, sy);
      const yMax = Math.max(this.dragStart.y, sy);
      const wMinX = (xMin - rect.width / 2) / this.camera.zoom + this.camera.x;
      const wMaxX = (xMax - rect.width / 2) / this.camera.zoom + this.camera.x;
      const wMinY = (yMin - rect.height / 2) / this.camera.zoom + this.camera.y;
      const wMaxY = (yMax - rect.height / 2) / this.camera.zoom + this.camera.y;

      const nextSel = new Set<string>();
      for (const id of state.entityOrder) {
        const ent = state.entities[id];
        if (!ent || ent.kind !== 'unit' || ent.ownerId !== 'p1') continue;
        if (ent.x >= wMinX && ent.x <= wMaxX && ent.y >= wMinY && ent.y <= wMaxY) {
          nextSel.add(id);
        }
      }
      this.selectedIds = nextSel;
      this.cb.onSelectionChange(new Set(this.selectedIds));
      this.cb.onBoxSelectChange(null);
      this.isDraggingBox = false;
      this.dragStart = null;
      return;
    }

    this.dragStart = null;

    // 0. Fire Armed Cyber Power or Superweapon
    const armed = this.cb.getArmedTargeting();
    if (armed) {
      if (armed.kind === 'superweapon') {
        this.cb.dispatch({ type: 'fireSuperweapon', playerId: 'p1', x: wx, y: wy });
      } else {
        this.cb.dispatch({
          type: 'useCyberPower',
          playerId: 'p1',
          powerId: armed.powerId,
          x: wx,
          y: wy,
        });
      }
      this.cb.clearArmedTargeting();
      return;
    }

    // 1. Place ready building if active
    const readyDefId = state.players.p1.readyBuildingDefId;
    if (readyDefId) {
      const tx = Math.floor(wx / state.map.tileSize);
      const ty = Math.floor(wy / state.map.tileSize);
      this.cb.dispatch({ type: 'placeBuilding', playerId: 'p1', defId: readyDefId, tileX: tx, tileY: ty });
      return;
    }

    // 2. Armed attack-move
    if (this.cb.getAttackMoveArmed() && this.selectedIds.size > 0) {
      this.cb.dispatch({
        type: 'moveUnits',
        playerId: 'p1',
        unitIds: Array.from(this.selectedIds),
        x: wx,
        y: wy,
        attackMove: true,
      });
      this.cb.clearAttackMoveArmed();
      return;
    }

    const picked = this.pickEntityAt(state, wx, wy);
    const now = performance.now();

    if (e.pointerType === 'touch' && this.selectedIds.size > 0) {
      if (picked && picked.ownerId === 'p1') {
        this.selectedIds = new Set([picked.id]);
        this.cb.onSelectionChange(new Set(this.selectedIds));
      } else {
        this.issueContextOrder(state, wx, wy);
      }
      return;
    }

    if (picked) {
      if (picked.kind === 'unit' && picked.ownerId === 'p1' && now - this.lastClickTime < 320) {
        const sameType = state.entityOrder.filter((id) => {
          const ent = state.entities[id];
          return ent && ent.kind === 'unit' && ent.ownerId === 'p1' && ent.defId === picked.defId;
        });
        this.selectedIds = new Set(sameType);
      } else if (e.shiftKey && picked.ownerId === 'p1') {
        if (this.selectedIds.has(picked.id)) this.selectedIds.delete(picked.id);
        else this.selectedIds.add(picked.id);
      } else {
        this.selectedIds = new Set([picked.id]);
      }
    } else {
      this.selectedIds.clear();
    }

    this.lastClickTime = now;
    this.cb.onSelectionChange(new Set(this.selectedIds));
  }

  private issueContextOrder(state: GameState, wx: number, wy: number): void {
    const unitIds = Array.from(this.selectedIds).filter((id) => {
      const e = state.entities[id];
      return e && e.kind === 'unit' && e.ownerId === 'p1';
    });
    if (unitIds.length === 0) {
      const hasFactory = Array.from(this.selectedIds).some((id) => {
        const e = state.entities[id];
        return e && e.kind === 'building' && e.ownerId === 'p1';
      });
      if (hasFactory) {
        this.cb.dispatch({ type: 'setRallyPoint', playerId: 'p1', x: wx, y: wy });
      }
      return;
    }

    const picked = this.pickEntityAt(state, wx, wy);
    if (picked) {
      if (picked.defId === 'silicon_node') {
        const hasHarvester = unitIds.some((id) => UNIT_DEFS[state.entities[id].defId as UnitId]?.canHarvest);
        if (hasHarvester) {
          this.cb.dispatch({ type: 'harvestNode', playerId: 'p1', unitIds, nodeId: picked.id });
          return;
        }
      }
      if (
        picked.kind === 'building' &&
        BUILDING_DEFS[picked.defId as BuildingId]?.isNeutralCapture &&
        picked.ownerId === 'neutral'
      ) {
        this.cb.dispatch({ type: 'captureBuilding', playerId: 'p1', unitIds, targetId: picked.id });
        return;
      }
      if (
        picked.defId === 'server_farm' &&
        picked.ownerId !== 'p1' &&
        unitIds.some((id) => state.entities[id].defId === 'unit_8200')
      ) {
        this.cb.dispatch({ type: 'plantImplant', playerId: 'p1', unitIds, targetId: picked.id });
        return;
      }
      if (picked.ownerId !== 'p1' && picked.ownerId !== 'neutral') {
        this.cb.dispatch({ type: 'attackEntity', playerId: 'p1', unitIds, targetId: picked.id });
        return;
      }
    }

    this.cb.dispatch({
      type: 'moveUnits',
      playerId: 'p1',
      unitIds,
      x: wx,
      y: wy,
      attackMove: this.cb.getAttackMoveArmed(),
    });
    this.cb.clearAttackMoveArmed();
  }

  private handleWheel(e: WheelEvent): void {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    this.camera.zoom *= factor;
    this.clampCamera();
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    this.keys.add(e.code);

    if (e.code === 'Tab') {
      e.preventDefault();
      this.cb.onCycleOverlay();
    } else if (e.code === 'Space') {
      e.preventDefault();
      this.cb.onTogglePause();
    } else if (e.code === 'F5') {
      e.preventDefault();
      this.cb.onQuickSave();
    } else if (e.code === 'F9') {
      e.preventDefault();
      this.cb.onQuickLoad();
    } else if (e.code === 'KeyH' || e.code === 'KeyX') {
      if (this.selectedIds.size > 0) {
        this.cb.dispatch({
          type: 'stopUnits',
          playerId: 'p1',
          unitIds: Array.from(this.selectedIds),
        });
      }
    } else if (e.code === 'Escape') {
      const state = this.cb.getState();
      if (this.cb.getArmedTargeting()) {
        this.cb.clearArmedTargeting();
      } else if (state.players.p1.readyBuildingDefId) {
        this.cb.dispatch({ type: 'cancelBuildBuilding', playerId: 'p1' });
      }
      this.cb.clearAttackMoveArmed();
    } else if (e.code >= 'Digit1' && e.code <= 'Digit4') {
      const slot = Number(e.code.replace('Digit', ''));
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        this.controlGroups.set(slot, Array.from(this.selectedIds));
      } else {
        const grp = this.controlGroups.get(slot);
        if (grp && grp.length > 0) {
          const state = this.cb.getState();
          const alive = grp.filter((id) => Boolean(state.entities[id]));
          this.setSelection(alive);
        }
      }
    }
  }
}
