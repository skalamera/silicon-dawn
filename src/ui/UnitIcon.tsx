import { useEffect, useState } from 'react';
import { type FactionId } from '../data/defs';
import { spriteAtlas } from '../renderer/SpriteAtlas';
import { Crosshair, Cpu, Factory, Radar, Shield, Ship, User, Zap } from 'lucide-react';

interface UnitIconProps {
  defId: string;
  kind: 'building' | 'unit';
  faction: FactionId;
}

export function UnitIcon({ defId, kind, faction }: UnitIconProps) {
  const [thumb, setThumb] = useState<string | undefined>(() => spriteAtlas.getThumbnail(defId));

  useEffect(() => {
    setThumb(spriteAtlas.getThumbnail(defId));
    return spriteAtlas.subscribe(() => {
      setThumb(spriteAtlas.getThumbnail(defId));
    });
  }, [defId]);

  const accentBorder =
    faction === 'alliance'
      ? 'border-sky-400/35 bg-sky-950/35'
      : faction === 'pact'
      ? 'border-rose-400/35 bg-rose-950/35'
      : 'border-amber-400/35 bg-amber-950/35';

  if (thumb) {
    return (
      <div
        className={`h-10 w-10 shrink-0 rounded border ${accentBorder} flex items-center justify-center overflow-hidden`}
      >
        <img
          src={thumb}
          alt=""
          className="h-9 w-9 object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.75)]"
        />
      </div>
    );
  }

  // Crisp tactical icon fallback for non-sheet items or pre-load
  const iconClass = 'h-5 w-5 text-sky-300';
  let IconEl = <Cpu className={iconClass} />;
  if (defId === 'smr') IconEl = <Zap className="h-5 w-5 text-cyan-300" />;
  else if (defId === 'war_factory' || defId === 'barracks') IconEl = <Factory className={iconClass} />;
  else if (defId === 'naval_dock' || defId === 'aegis_corvette' || defId === 'drone_mothership' || defId === 'fac_boat') {
    IconEl = <Ship className="h-5 w-5 text-cyan-300" />;
  } else if (defId === 'seismic_sensor' || defId === 'jam_tower' || defId === 'decoy_battery') {
    IconEl = <Radar className="h-5 w-5 text-amber-300" />;
  } else if (defId === 'prometheus_uplink' || defId === 'kessler_silo' || defId === 'chokepoint_hub' || defId === 'popup_silo') {
    IconEl = <Crosshair className="h-5 w-5 text-rose-300" />;
  } else if (
    kind === 'unit' &&
    (defId === 'forward_controller' ||
      defId === 'valkyrie' ||
      defId === 'unit_8200' ||
      defId === 'shock_trooper' ||
      defId === 'ew_sapper' ||
      defId === 'teleop_militia')
  ) {
    IconEl = <User className="h-5 w-5 text-emerald-300" />;
  } else if (defId === 'mcv' || defId === 'ied_crawler') {
    IconEl = <Shield className="h-5 w-5 text-slate-200" />;
  }

  return (
    <div
      className={`h-10 w-10 shrink-0 rounded border ${accentBorder} flex items-center justify-center`}
    >
      {IconEl}
    </div>
  );
}
