import { BUILDING_DEFS, UNIT_DEFS, type BuildingId, type UnitId } from '../data/defs';
import { launchSwarmFromUnit } from './abilities';
import { getVeterancyLabel, nextId, pushAlert } from './helpers';
import { computeSeparation, findPath, type PathMode } from './pathfinding';
import { nextFloat } from './prng';
import type { Entity, GameState, SmokeCloud } from './types';

function segmentIntersectsCircle(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  cx: number,
  cy: number,
  r: number
): boolean {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(cx - x1, cy - y1) <= r;
  const t = Math.max(0, Math.min(1, ((cx - x1) * dx + (cy - y1) * dy) / lenSq));
  const px = x1 + t * dx;
  const py = y1 + t * dy;
  return Math.hypot(cx - px, cy - py) <= r;
}

function isBeamThroughSmoke(clouds: SmokeCloud[], x1: number, y1: number, x2: number, y2: number): boolean {
  for (const c of clouds) {
    if (segmentIntersectsCircle(x1, y1, x2, y2, c.x, c.y, c.radius)) {
      return true;
    }
  }
  return false;
}

function getEntityStats(ent: Entity): {
  sight: number;
  range: number;
  damage: number;
  fireInterval: number;
  weaponType: string;
  projSpeed: number;
  isRocket: boolean;
  aoeRadius: number;
  tags: string[];
} {
  const vetDmgMult =
    ent.veterancy === 3 ? 1.5 : ent.veterancy === 2 ? 1.3 : ent.veterancy === 1 ? 1.15 : 1.0;
  const vetRateMult =
    ent.veterancy === 3 ? 0.68 : ent.veterancy === 2 ? 0.8 : ent.veterancy === 1 ? 0.9 : 1.0;
  if (ent.kind === 'building') {
    const d = BUILDING_DEFS[ent.defId as BuildingId];
    return {
      sight: d.sightRange,
      range: d.attackRange,
      damage: d.damage * vetDmgMult,
      fireInterval: d.fireInterval * vetRateMult,
      weaponType: d.weaponType,
      projSpeed: d.weaponType === 'missile' ? 460 : 0,
      isRocket: d.weaponType === 'missile',
      aoeRadius: 0,
      tags: ['AUTONOMOUS'],
    };
  }
  const d = UNIT_DEFS[ent.defId as UnitId];
  return {
    sight: d.sightRange,
    range: d.attackRange,
    damage: d.damage * vetDmgMult,
    fireInterval: d.fireInterval * vetRateMult,
    weaponType: d.weaponType,
    projSpeed: d.projectileSpeed,
    isRocket: Boolean(d.isRocket),
    aoeRadius: d.aoeRadius ?? 0,
    tags: d.tags,
  };
}

function getUnitPathMode(ent: Entity): PathMode {
  const def = UNIT_DEFS[ent.defId as UnitId];
  if (def.tags.includes('AIR')) return 'air';
  if (def.tags.includes('NAVAL')) return 'naval';
  if (ent.burrowed) return 'burrowed';
  return 'ground';
}

function applyDamage(
  state: GameState,
  target: Entity,
  amount: number,
  attackerId?: string,
  weaponType?: string
): void {
  if (target.defId === 'silicon_node') return;
  if (target.kind === 'building' && BUILDING_DEFS[target.defId as BuildingId].isPopupSilo && target.siloOpenTimer <= 0) {
    // Untargetable while flush underground
    return;
  }

  let finalDmg = amount;
  // Thermobaric bunker-buster deals 2.5x vs burrowed subterranean units & forces surface
  if (target.burrowed && weaponType === 'thermobaric') {
    finalDmg *= 2.5;
    target.burrowed = false;
  }

  const wasAlive = target.hp > 0;
  target.hp -= finalDmg;
  if (wasAlive && target.hp <= 0 && attackerId && state.entities[attackerId]) {
    const atk = state.entities[attackerId];
    if (atk.ownerId === target.ownerId) return;

    atk.kills += 1;
    const xpGain =
      target.kind === 'building'
        ? 2
        : (UNIT_DEFS[target.defId as UnitId]?.cost ?? 0) >= 650
        ? 2
        : 1;
    atk.xp = (atk.xp ?? 0) + xpGain;

    const nextRank: 0 | 1 | 2 | 3 =
      atk.xp >= 9 ? 3 : atk.xp >= 5 ? 2 : atk.xp >= 2 ? 1 : 0;

    if (nextRank > atk.veterancy) {
      const baseHp =
        atk.kind === 'building'
          ? BUILDING_DEFS[atk.defId as BuildingId].hp
          : UNIT_DEFS[atk.defId as UnitId].hp;
      const hpMult = nextRank === 3 ? 1.5 : nextRank === 2 ? 1.3 : 1.15;
      const healPct = nextRank === 3 ? 0.5 : nextRank === 2 ? 0.35 : 0.25;
      atk.maxHp = Math.round(baseHp * hpMult);
      atk.hp = Math.min(atk.maxHp, atk.hp + Math.round(atk.maxHp * healPct));
      atk.veterancy = nextRank;

      state.explosions.push({
        id: nextId(state, 'promo'),
        x: atk.x,
        y: atk.y,
        radius: 34,
        color: '#facc15',
        life: 0.55,
        maxLife: 0.55,
      });

      if (atk.ownerId === 'p1') {
        const shortName =
          atk.kind === 'building'
            ? BUILDING_DEFS[atk.defId as BuildingId].shortName
            : UNIT_DEFS[atk.defId as UnitId].shortName;
        pushAlert(
          state,
          `UNIT PROMOTED: ${shortName} reached ${getVeterancyLabel(nextRank)} (${'★'.repeat(nextRank)})!`,
          'info'
        );
      }
    }
  }
}

export function updateCombatAndMovement(state: GameState, dt: number): void {
  // 1. Update Jamming Domes from Krasukha-Q trucks & Jam Towers
  state.jamDomes = [];
  for (const id of state.entityOrder) {
    const e = state.entities[id];
    if (!e || e.ownerId === 'neutral' || e.safeMode) continue;
    const jamR =
      e.kind === 'building'
        ? BUILDING_DEFS[e.defId as BuildingId].jamRadius
        : UNIT_DEFS[e.defId as UnitId].jamRadius;
    if (jamR) {
      state.jamDomes.push({
        ownerId: e.ownerId,
        sourceId: e.id,
        x: e.x,
        y: e.y,
        radius: jamR,
      });
    }
  }

  // Collect Seismic Sensor posts for stealth & tunnel reveal
  const seismicPosts: Array<{ ownerId: string; x: number; y: number; r: number }> = [];
  for (const id of state.entityOrder) {
    const e = state.entities[id];
    if (!e || e.kind !== 'building') continue;
    const sr = BUILDING_DEFS[e.defId as BuildingId].seismicRadius;
    if (sr && (state.players[e.ownerId]?.powerRatio ?? 1) >= 0.8) {
      seismicPosts.push({ ownerId: e.ownerId, x: e.x, y: e.y, r: sr });
    }
  }

  // 2. Decay VFX & Smoke Clouds
  state.beams = state.beams.filter((b) => {
    b.life -= dt;
    return b.life > 0;
  });
  state.smokeClouds = state.smokeClouds.filter((c) => {
    c.life -= dt;
    return c.life > 0;
  });
  state.explosions = state.explosions.filter((ex) => {
    ex.life -= dt;
    return ex.life > 0;
  });
  state.alerts = state.alerts.filter((a) => {
    a.ttl -= dt;
    return a.ttl > 0;
  });

  const worldW = state.map.width * state.map.tileSize;
  const worldH = state.map.height * state.map.tileSize;

  // 3. Unit Jamming, Stealth/Seismic Reveal, Movement & Type-99X Welding
  for (const id of state.entityOrder) {
    const ent = state.entities[id];
    if (!ent) continue;

    ent.cooldown = Math.max(0, ent.cooldown - dt);
    ent.apsCooldown = Math.max(0, ent.apsCooldown - dt);
    ent.smokeCooldown = Math.max(0, ent.smokeCooldown - dt);
    ent.slowTimer = Math.max(0, ent.slowTimer - dt);
    ent.repairing = false;

    if (ent.kind !== 'unit') continue;

    const uDef = UNIT_DEFS[ent.defId as UnitId];
    const p = state.players[ent.ownerId];
    const isHuman = uDef.tags.includes('HUMAN');
    const isQuantum = uDef.tags.includes('QUANTUM_NAV');
    const isAir = uDef.tags.includes('AIR');
    const isNaval = uDef.tags.includes('NAVAL');

    // Stealth & burrowed visibility check
    const isConcealed = uDef.tags.includes('STEALTH') || ent.burrowed;
    if (!isConcealed) {
      ent.isRevealed = true;
    } else {
      let revealed = false;
      for (const s of seismicPosts) {
        if (s.ownerId !== ent.ownerId && Math.hypot(ent.x - s.x, ent.y - s.y) <= s.r) {
          revealed = true;
          break;
        }
      }
      if (!revealed) {
        for (const oid of state.entityOrder) {
          const other = state.entities[oid];
          if (!other || other.ownerId === 'neutral' || other.ownerId === ent.ownerId) continue;
          const revealRange = ent.burrowed ? 60 : 92;
          if (Math.hypot(ent.x - other.x, ent.y - other.y) <= revealRange) {
            revealed = true;
            break;
          }
        }
      }
      ent.isRevealed = revealed;
    }

    // GPS-Denied Jamming Dome check (Tethered & Quantum-Nav & Human immune!)
    ent.jammed = false;
    if (!isHuman && !isQuantum && !ent.tethered) {
      for (const dome of state.jamDomes) {
        if (dome.ownerId !== ent.ownerId && Math.hypot(ent.x - dome.x, ent.y - dome.y) <= dome.radius) {
          ent.jammed = true;
          // Low-tier wireless drones (e.g. Shahed / Anti-Rad) drop out of the sky!
          if (isAir && (ent.defId === 'shahed_drone' || ent.defId === 'anti_rad_drone')) {
            ent.hp -= 55 * dt;
          }
          break;
        }
      }
    }

    // Auto-launch swarm when Shahed-X or Drone Mothership sees enemy in 380px
    if (uDef.canLaunchSwarm && ent.launchCooldown <= 0 && !ent.safeMode) {
      for (const oid of state.entityOrder) {
        const enemy = state.entities[oid];
        if (!enemy || enemy.ownerId === 'neutral' || enemy.ownerId === ent.ownerId) continue;
        if (Math.hypot(enemy.x - ent.x, enemy.y - ent.y) <= 380) {
          launchSwarmFromUnit(state, ent, enemy.x, enemy.y);
          break;
        }
      }
    }

    if (ent.safeMode) {
      ent.vx = 0;
      ent.vy = 0;
      continue;
    }

    // Repath periodically for moving attackTarget / implant orders
    ent.pathAge += dt;
    if (
      (ent.order.type === 'attackTarget' || ent.order.type === 'implant') &&
      ent.order.targetEntityId
    ) {
      const target = state.entities[ent.order.targetEntityId];
      if (!target) {
        ent.order = { type: 'idle', targetX: ent.x, targetY: ent.y };
        ent.path = [];
      } else {
        const desiredDist = ent.order.type === 'implant' ? 56 : uDef.attackRange * 0.9;
        const dist = Math.hypot(target.x - ent.x, target.y - ent.y);
        if (dist <= desiredDist) {
          ent.path = [];
        } else if (ent.path.length === 0 || ent.pathAge > 0.75) {
          ent.pathAge = 0;
          ent.path = findPath(state, ent.x, ent.y, target.x, target.y, getUnitPathMode(ent));
        }
      }
    }

    // Move along path
    if (ent.path.length > 0) {
      const wp = ent.path[0];
      let dx = wp.x - ent.x;
      let dy = wp.y - ent.y;
      const dist = Math.hypot(dx, dy);

      // Shahed-X Hive-Mind split curve if another drone in its swarm was laser-intercepted
      if (ent.swarmSplitActive && ent.swarmSplitBias && dist > 35) {
        const perpX = -dy / Math.max(1, dist);
        const perpY = dx / Math.max(1, dist);
        dx += perpX * ent.swarmSplitBias * 1.4;
        dy += perpY * ent.swarmSplitBias * 1.4;
      }

      if (dist < 16) {
        ent.path.shift();
        if (ent.path.length === 0 && (ent.order.type === 'move' || ent.order.type === 'attackMove')) {
          ent.order = { type: 'idle', targetX: ent.x, targetY: ent.y };
        }
      } else {
        const latMult = uDef.tags.includes('AUTONOMOUS') && p ? p.latencyFactor : 1.0;
        const ocMult = uDef.tags.includes('AUTONOMOUS') && p?.overclock ? 1.35 : 1.0;
        const jamMult = ent.jammed ? 0.65 : 1.0;
        const slowMult = ent.slowTimer > 0 ? 0.6 : 1.0;
        const vetSpdMult = ent.veterancy === 3 ? 1.15 : ent.veterancy === 2 ? 1.1 : 1.0;
        const spd = uDef.speed * latMult * ocMult * jamMult * slowMult * vetSpdMult;

        const sep = isAir ? { sx: 0, sy: 0 } : computeSeparation(state, ent);
        const norm = Math.max(1, Math.hypot(dx, dy));
        const vx = (dx / norm) * spd + sep.sx;
        const vy = (dy / norm) * spd + sep.sy;
        ent.vx = vx;
        ent.vy = vy;
        ent.x = Math.max(20, Math.min(worldW - 20, ent.x + vx * dt));
        ent.y = Math.max(20, Math.min(worldH - 20, ent.y + vy * dt));
        ent.angle = Math.atan2(vy, vx);

        // Strait Chokepoint: naval units take continuous hull damage while moving!
        if (isNaval && p && p.chokepointTimer > 0) {
          ent.hp -= 24 * dt;
        }
      }
    } else {
      ent.vx = 0;
      ent.vy = 0;
      if (uDef.hasMutualRepair && ent.hp > 0) {
        for (const otherId of state.entityOrder) {
          if (otherId === ent.id) continue;
          const ally = state.entities[otherId];
          if (!ally || ally.kind !== 'unit' || ally.ownerId !== ent.ownerId || ally.defId !== 'type_99x') {
            continue;
          }
          if (ally.hp < ally.maxHp && Math.hypot(ally.x - ent.x, ally.y - ent.y) <= 95) {
            ally.hp = Math.min(ally.maxHp, ally.hp + 14 * dt);
            ent.repairing = true;
            if (state.tick % 6 === 0) {
              state.beams.push({
                id: nextId(state, 'weld'),
                ownerId: ent.ownerId,
                x1: ent.x,
                y1: ent.y - 4,
                x2: ally.x,
                y2: ally.y - 4,
                scatteredBySmoke: false,
                kind: 'weld',
                life: 0.22,
                maxLife: 0.22,
              });
            }
            break;
          }
        }
      }
    }
  }

  // 3b. Active Manual Repairs, Service Bay Auto-Repair & Heroic Self-Repair
  const serviceBaysByOwner: Record<string, Entity[]> = {};
  for (const id of state.entityOrder) {
    const b = state.entities[id];
    if (
      b &&
      b.kind === 'building' &&
      b.ownerId !== 'neutral' &&
      b.hp > 0 &&
      (b.defId === 'conyard' || b.defId === 'war_factory' || b.defId === 'naval_dock')
    ) {
      (serviceBaysByOwner[b.ownerId] ??= []).push(b);
    }
  }

  for (const id of state.entityOrder) {
    const ent = state.entities[id];
    if (!ent || ent.ownerId === 'neutral' || ent.hp <= 0 || ent.defId === 'silicon_node') continue;
    const owner = state.players[ent.ownerId];
    if (!owner) continue;

    // Heroic (★★★) passive field self-repair (free)
    if (ent.veterancy === 3 && ent.hp < ent.maxHp) {
      ent.hp = Math.min(ent.maxHp, ent.hp + 10 * dt);
      ent.repairing = true;
    }

    // Manual repair command toggle (works on both buildings and units)
    if (ent.manualRepair) {
      if (ent.hp >= ent.maxHp) {
        ent.manualRepair = false;
      } else if (owner.silicon > 0.2) {
        const rate =
          ent.kind === 'building' ? 30 : ent.path.length === 0 ? 20 : 10;
        const costPerHp = ent.kind === 'building' ? 0.22 : 0.25;
        const heal = Math.min(ent.maxHp - ent.hp, rate * dt, owner.silicon / costPerHp);
        if (heal > 0) {
          ent.hp = Math.min(ent.maxHp, ent.hp + heal);
          owner.silicon = Math.max(0, owner.silicon - heal * costPerHp);
          ent.repairing = true;
        }
        if (ent.hp >= ent.maxHp || owner.silicon <= 0.2) {
          ent.manualRepair = false;
        }
      } else {
        ent.manualRepair = false;
      }
    }

    // Automatic War Factory / Naval Dock / ConYard Service Bay proximity repair
    if (ent.kind === 'unit' && ent.hp < ent.maxHp && !ent.manualRepair && owner.silicon > 0.2) {
      const uDef = UNIT_DEFS[ent.defId as UnitId];
      const isNaval = uDef.tags.includes('NAVAL');
      const bays = serviceBaysByOwner[ent.ownerId] ?? [];
      for (const bay of bays) {
        if (isNaval && bay.defId === 'war_factory') continue;
        if (!isNaval && bay.defId === 'naval_dock') continue;
        if (Math.hypot(ent.x - bay.x, ent.y - bay.y) <= 180) {
          const heal = Math.min(ent.maxHp - ent.hp, 28 * dt, owner.silicon / 0.14);
          if (heal > 0) {
            ent.hp = Math.min(ent.maxHp, ent.hp + heal);
            owner.silicon = Math.max(0, owner.silicon - heal * 0.14);
            ent.repairing = true;
            if (state.tick % 6 === 0) {
              state.beams.push({
                id: nextId(state, 'svcweld'),
                ownerId: ent.ownerId,
                x1: bay.x,
                y1: bay.y - 6,
                x2: ent.x,
                y2: ent.y - 4,
                scatteredBySmoke: false,
                kind: 'weld',
                life: 0.22,
                maxLife: 0.22,
              });
            }
          }
          break;
        }
      }
    }
  }

  // 4. Target Acquisition & Firing (including Adversarial Data Poisoning friendly fire!)
  for (const id of state.entityOrder) {
    const ent = state.entities[id];
    if (!ent || ent.ownerId === 'neutral' || ent.safeMode || ent.burrowed) continue;

    const stats = getEntityStats(ent);
    if (stats.weaponType === 'none' || stats.range <= 0) continue;

    const owner = state.players[ent.ownerId];
    if (!owner) continue;

    if (ent.kind === 'building') {
      const bDef = BUILDING_DEFS[ent.defId as BuildingId];
      if (bDef.isEnergyDefense && owner.powerRatio < 1.0) continue;
    }

    if (ent.kind === 'unit' && (ent.order.type === 'move' || ent.order.type === 'harvest')) {
      continue;
    }

    const poisoned = ent.poisonTimer > 0 && !ent.tethered && !stats.tags.includes('HUMAN');
    const isAntiRad = ent.kind === 'unit' && Boolean(UNIT_DEFS[ent.defId as UnitId].antiRadiation);

    let target: Entity | null = null;
    if (!poisoned && ent.kind === 'unit' && ent.order.type === 'attackTarget' && ent.order.targetEntityId) {
      const cand = state.entities[ent.order.targetEntityId];
      if (cand && cand.ownerId !== ent.ownerId && cand.ownerId !== 'neutral' && cand.isRevealed) {
        if (Math.hypot(cand.x - ent.x, cand.y - ent.y) <= stats.range) {
          target = cand;
        }
      }
    }

    if (!target) {
      let bestScore = Infinity;
      for (const tid of state.entityOrder) {
        if (tid === ent.id) continue;
        const cand = state.entities[tid];
        if (!cand || cand.ownerId === 'neutral') continue;

        // Adversarial Data Poisoning targets OWN allies!
        if (poisoned) {
          if (cand.ownerId !== ent.ownerId) continue;
        } else {
          if (cand.ownerId === ent.ownerId) continue;
          if (!cand.isRevealed) continue;
          if (
            cand.kind === 'building' &&
            BUILDING_DEFS[cand.defId as BuildingId].isPopupSilo &&
            cand.siloOpenTimer <= 0
          ) {
            continue;
          }
        }

        const d = Math.hypot(cand.x - ent.x, cand.y - ent.y);
        if (d <= stats.range) {
          let score = d + (cand.kind === 'building' ? 35 : 0);
          if (isAntiRad && (cand.defId === 'krasukha_q' || cand.defId === 'jam_tower' || cand.defId === 'smr')) {
            score -= 120;
          }
          // Axis Decoy Batteries attract AI/auto-target priority until unit gets within 110px optical check
          if (cand.kind === 'building' && cand.defId === 'decoy_battery' && d > 110) {
            score -= 90;
          }
          if (score < bestScore) {
            bestScore = score;
            target = cand;
          }
        }
      }
    }

    if (!target) continue;

    if (ent.kind === 'unit' && ent.order.type === 'attackMove') {
      ent.path = [];
    }

    ent.turretAngle = Math.atan2(target.y - ent.y, target.x - ent.x);

    if (ent.cooldown > 0) continue;

    // Pop-Up Silo opens blast doors when firing
    if (ent.kind === 'building' && BUILDING_DEFS[ent.defId as BuildingId].isPopupSilo) {
      ent.siloOpenTimer = 2.5;
    }

    const isAutonomous = stats.tags.includes('AUTONOMOUS');
    const latMult = isAutonomous ? owner.latencyFactor : 1.0;
    const ocMult = isAutonomous && owner.overclock ? 1.5 : 1.0;
    const auraMult = isAutonomous && ent.humanOverride ? 1.2 : 1.0;
    const effectiveRate = Math.max(0.3, latMult * ocMult * auraMult);
    ent.cooldown = stats.fireInterval / effectiveRate;

    if (stats.weaponType === 'kamikaze') {
      applyDamage(state, target, stats.damage, ent.id, 'kamikaze');
      ent.hp = 0; // Detonates self
      state.explosions.push({
        id: nextId(state, 'kam'),
        x: target.x,
        y: target.y,
        radius: 26,
        color: '#f59e0b',
        life: 0.45,
        maxLife: 0.45,
      });
    } else if (stats.weaponType === 'laser_hel') {
      const throughSmoke = isBeamThroughSmoke(state.smokeClouds, ent.x, ent.y - 12, target.x, target.y);
      const dmg = throughSmoke ? stats.damage * 0.2 : stats.damage;
      const targetBefore = target.hp;
      applyDamage(state, target, dmg, ent.id, 'laser_hel');

      // Shahed-X Hive-Mind Swarm Split when Iron Beam downs a drone!
      if (targetBefore > 0 && target.hp <= 0 && target.swarmId) {
        for (const sid of state.entityOrder) {
          const sib = state.entities[sid];
          if (sib && sib.id !== target.id && sib.swarmId === target.swarmId) {
            sib.swarmSplitActive = true;
          }
        }
      }

      state.beams.push({
        id: nextId(state, 'hel'),
        ownerId: ent.ownerId,
        x1: ent.x,
        y1: ent.y - 12,
        x2: target.x,
        y2: target.y,
        scatteredBySmoke: throughSmoke,
        kind: 'laser_hel',
        life: 0.22,
        maxLife: 0.22,
      });
    } else if (stats.weaponType === 'hpm_cone') {
      const baseAng = Math.atan2(target.y - ent.y, target.x - ent.x);
      let hits = 0;
      for (const tid of state.entityOrder) {
        const cand = state.entities[tid];
        if (!cand || cand.ownerId === 'neutral') continue;
        if (poisoned ? cand.ownerId !== ent.ownerId : cand.ownerId === ent.ownerId) continue;
        const d = Math.hypot(cand.x - ent.x, cand.y - ent.y);
        if (d > stats.range) continue;
        const angDiff = Math.abs(
          Math.atan2(
            Math.sin(Math.atan2(cand.y - ent.y, cand.x - ent.x) - baseAng),
            Math.cos(Math.atan2(cand.y - ent.y, cand.x - ent.x) - baseAng)
          )
        );
        if (angDiff > 0.65) continue;

        hits++;
        if (hits > 5) break;

        if (cand.kind === 'unit') {
          const cDef = UNIT_DEFS[cand.defId as UnitId];
          const isHeavyHuman = cDef.tags.includes('HUMAN') && cDef.tags.includes('ARMORED');
          if (isHeavyHuman) continue;
          const mult = cDef.tags.includes('AUTONOMOUS') ? 1.25 : 0.4;
          applyDamage(state, cand, stats.damage * mult, ent.id, 'hpm_cone');
          if (cDef.tags.includes('AUTONOMOUS')) {
            cand.slowTimer = Math.max(cand.slowTimer, 1.8);
          }
        } else {
          applyDamage(state, cand, stats.damage * 0.4, ent.id, 'hpm_cone');
        }
      }
      state.beams.push({
        id: nextId(state, 'hpm'),
        ownerId: ent.ownerId,
        x1: ent.x,
        y1: ent.y - 12,
        x2: target.x,
        y2: target.y,
        scatteredBySmoke: false,
        kind: 'hpm_cone',
        life: 0.3,
        maxLife: 0.3,
      });
    } else {
      let tx = target.x;
      let ty = target.y;
      if (ent.jammed || (isAutonomous && owner.latencyFactor < 0.85)) {
        const scatter = ent.jammed ? 38 : 22;
        tx += (nextFloat(state.rng) - 0.5) * scatter * 2;
        ty += (nextFloat(state.rng) - 0.5) * scatter * 2;
      }
      state.projectiles.push({
        id: nextId(state, 'proj'),
        ownerId: ent.ownerId,
        sourceId: ent.id,
        x: ent.x,
        y: ent.y - 4,
        tx,
        ty,
        targetId: target.id,
        speed: stats.projSpeed,
        damage: stats.damage,
        weaponType: stats.weaponType as never,
        isRocket: stats.isRocket,
        fromJammed: ent.jammed,
        aoeRadius: stats.aoeRadius,
        life: 2.2,
      });
    }
  }

  // 5. Move Projectiles & Resolve Impacts (+ Trophy APS & Thermobaric AoE)
  const remainingProj = [];
  for (const proj of state.projectiles) {
    proj.life -= dt;
    if (proj.life <= 0) continue;

    if (proj.targetId && !proj.fromJammed && state.entities[proj.targetId]) {
      const liveTarget = state.entities[proj.targetId];
      proj.tx = liveTarget.x;
      proj.ty = liveTarget.y;
    }

    const dx = proj.tx - proj.x;
    const dy = proj.ty - proj.y;
    const dist = Math.hypot(dx, dy);
    const step = proj.speed * dt;

    if (dist <= step + 8) {
      let intercepted = false;
      if (proj.isRocket) {
        for (const eid of state.entityOrder) {
          const defUnit = state.entities[eid];
          if (!defUnit || defUnit.kind !== 'unit' || defUnit.ownerId === proj.ownerId || defUnit.safeMode) {
            continue;
          }
          const uDef = UNIT_DEFS[defUnit.defId as UnitId];
          if (
            uDef.hasTrophyAps &&
            defUnit.apsCooldown <= 0 &&
            Math.hypot(defUnit.x - proj.tx, defUnit.y - proj.ty) <= 52
          ) {
            defUnit.apsCooldown = 5.0;
            intercepted = true;
            state.beams.push({
              id: nextId(state, 'aps'),
              ownerId: defUnit.ownerId,
              x1: defUnit.x,
              y1: defUnit.y - 4,
              x2: proj.x,
              y2: proj.y,
              scatteredBySmoke: false,
              kind: 'aps_intercept',
              life: 0.25,
              maxLife: 0.25,
            });
            break;
          }
        }
      }

      if (!intercepted) {
        if (proj.aoeRadius && proj.aoeRadius > 0) {
          // Thermobaric AoE blast — damages everything in radius, including burrowed tunnels!
          for (const eid of state.entityOrder) {
            const cand = state.entities[eid];
            if (!cand || cand.ownerId === 'neutral' || cand.ownerId === proj.ownerId) continue;
            if (Math.hypot(cand.x - proj.tx, cand.y - proj.ty) <= proj.aoeRadius) {
              applyDamage(state, cand, proj.damage, proj.sourceId, proj.weaponType);
            }
          }
          state.explosions.push({
            id: nextId(state, 'thermo'),
            x: proj.tx,
            y: proj.ty,
            radius: proj.aoeRadius,
            color: '#f97316',
            life: 0.55,
            maxLife: 0.55,
          });
          state.scorchMarks.push({ x: proj.tx, y: proj.ty, r: 22 });
          if (state.scorchMarks.length > 60) state.scorchMarks.shift();
        } else {
          let hitEntity = proj.targetId ? state.entities[proj.targetId] : undefined;
          if (!hitEntity || Math.hypot(hitEntity.x - proj.tx, hitEntity.y - proj.ty) > 36) {
            hitEntity = undefined;
            for (const eid of state.entityOrder) {
              const cand = state.entities[eid];
              if (!cand || cand.ownerId === proj.ownerId || cand.ownerId === 'neutral') continue;
              if (Math.hypot(cand.x - proj.tx, cand.y - proj.ty) <= 28) {
                hitEntity = cand;
                break;
              }
            }
          }
          if (hitEntity) {
            applyDamage(state, hitEntity, proj.damage, proj.sourceId, proj.weaponType);
          }
          state.explosions.push({
            id: nextId(state, 'hit'),
            x: proj.tx,
            y: proj.ty,
            radius: proj.weaponType === 'cannon' || proj.weaponType === 'missile' ? 14 : 7,
            color: proj.weaponType === 'cannon' ? '#fb923c' : '#fde047',
            life: 0.22,
            maxLife: 0.22,
          });
        }
      }
      continue;
    }

    proj.x += (dx / dist) * step;
    proj.y += (dy / dist) * step;
    remainingProj.push(proj);
  }
  state.projectiles = remainingProj;

  // 6. Remove Destroyed Entities
  const aliveOrder: string[] = [];
  for (const id of state.entityOrder) {
    const ent = state.entities[id];
    if (!ent) continue;
    if (ent.hp <= 0) {
      if (ent.kind === 'building' && BUILDING_DEFS[ent.defId as BuildingId]?.isNeutralCapture) {
        ent.ownerId = 'neutral';
        ent.hp = 450;
        aliveOrder.push(id);
        continue;
      }
      state.explosions.push({
        id: nextId(state, 'boom'),
        x: ent.x,
        y: ent.y,
        radius: ent.kind === 'building' ? 46 : 22,
        color: ent.kind === 'building' ? '#f97316' : '#fb923c',
        life: ent.kind === 'building' ? 0.7 : 0.4,
        maxLife: ent.kind === 'building' ? 0.7 : 0.4,
      });
      state.scorchMarks.push({ x: ent.x, y: ent.y, r: ent.kind === 'building' ? 28 : 13 });
      if (state.scorchMarks.length > 60) state.scorchMarks.shift();
      if (ent.kind === 'building' && ent.ownerId === 'p1' && ent.defId === 'server_farm') {
        pushAlert(state, 'Server Farm destroyed! Check FLOPS latency.', 'danger');
      }
      delete state.entities[id];
    } else {
      aliveOrder.push(id);
    }
  }
  state.entityOrder = aliveOrder;

  if (state.tick % 4 === 0) {
    updateFogOfWar(state);
  }
}

export function updateFogOfWar(state: GameState): void {
  const { width, height, tileSize } = state.map;
  const kesslerActive = state.kesslerTimer > 0;

  for (const pid of Object.keys(state.players)) {
    if (pid === 'neutral') continue;
    const grid = state.fog[pid];
    if (!grid) continue;

    for (let i = 0; i < grid.length; i++) {
      if (grid[i] === 2) grid[i] = 1;
    }

    for (const id of state.entityOrder) {
      const ent = state.entities[id];
      if (!ent) continue;

      // Grant sight if owned by pid OR Zero-Day implanted by pid!
      const ownsVision = ent.ownerId === pid;
      const implantedVision = ent.implantedBy === pid;
      if (!ownsVision && !implantedVision) continue;

      let sight =
        ent.kind === 'building'
          ? BUILDING_DEFS[ent.defId as BuildingId].sightRange
          : UNIT_DEFS[ent.defId as UnitId].sightRange;
      const empImmune =
        ent.kind === 'building' && Boolean(BUILDING_DEFS[ent.defId as BuildingId].immuneToEmp);
      if (kesslerActive && !implantedVision && !empImmune) {
        sight = Math.min(sight, 150);
      } else if (ent.kind === 'unit' && ent.jammed) {
        sight *= 0.65;
      }

      const tileRadius = Math.ceil(sight / tileSize);
      const cx = Math.floor(ent.x / tileSize);
      const cy = Math.floor(ent.y / tileSize);

      for (let dy = -tileRadius; dy <= tileRadius; dy++) {
        for (let dx = -tileRadius; dx <= tileRadius; dx++) {
          const tx = cx + dx;
          const ty = cy + dy;
          if (tx < 0 || ty < 0 || tx >= width || ty >= height) continue;
          if (dx * dx + dy * dy <= tileRadius * tileRadius) {
            grid[ty * width + tx] = 2;
          }
        }
      }
    }
  }
}
