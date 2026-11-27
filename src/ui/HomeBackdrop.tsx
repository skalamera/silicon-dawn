import { useEffect, useRef } from 'react';

interface HomeBackdropProps {
  motionPaused: boolean;
  heroImageSrc?: string;
}

interface AshParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  ember: boolean;
}

export function HomeBackdrop({ motionPaused, heroImageSrc }: HomeBackdropProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let rafId = 0;
    let width = 0;
    let height = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const particles: AshParticle[] = Array.from({ length: 78 }, (_, i) => ({
      x: ((i * 197.3) % 1000) / 1000,
      y: ((i * 313.7) % 1000) / 1000,
      vx: 0.008 + ((i % 7) * 0.0025),
      vy: -(0.007 + ((i % 5) * 0.003)),
      size: 1 + (i % 3) * 0.85,
      alpha: 0.14 + (i % 6) * 0.08,
      ember: i % 9 === 0,
    }));

    const drawFrame = (animate: boolean, dt: number) => {
      ctx.clearRect(0, 0, width, height);

      // Soft bottom atmospheric haze pools
      const haze = ctx.createLinearGradient(0, height * 0.42, 0, height);
      haze.addColorStop(0, 'rgba(130, 152, 126, 0)');
      haze.addColorStop(0.55, 'rgba(34, 46, 35, 0.24)');
      haze.addColorStop(1, 'rgba(5, 9, 6, 0.72)');
      ctx.fillStyle = haze;
      ctx.fillRect(0, height * 0.42, width, height * 0.58);

      for (const p of particles) {
        if (animate) {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          if (p.x > 1.04) p.x = -0.04;
          if (p.y < -0.04) {
            p.y = 1.04;
            p.x = (p.x + 0.37) % 1;
          }
        }
        const px = p.x * width;
        const py = p.y * height;
        ctx.fillStyle = p.ember
          ? `rgba(126, 249, 168, ${p.alpha * 0.85})`
          : `rgba(218, 228, 212, ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const shouldAnimate = !motionPaused && !reduceQuery.matches;
      drawFrame(shouldAnimate, dt);
      if (shouldAnimate) {
        rafId = requestAnimationFrame(tick);
      }
    };

    drawFrame(false, 0);
    if (!motionPaused && !reduceQuery.matches) {
      rafId = requestAnimationFrame(tick);
    }

    const onMotionChange = () => {
      cancelAnimationFrame(rafId);
      if (!motionPaused && !reduceQuery.matches) {
        last = performance.now();
        rafId = requestAnimationFrame(tick);
      } else {
        drawFrame(false, 0);
      }
    };

    window.addEventListener('resize', resize);
    reduceQuery.addEventListener('change', onMotionChange);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      reduceQuery.removeEventListener('change', onMotionChange);
    };
  }, [motionPaused]);

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 overflow-hidden bg-[#080d09] ${
        motionPaused ? 'motion-paused' : ''
      }`}
    >
      {heroImageSrc ? (
        <img
          src={heroImageSrc}
          alt=""
          fetchPriority="high"
          decoding="async"
          className="home-hero-drift absolute inset-0 h-full w-full object-cover object-center brightness-[0.82] contrast-[1.08] saturate-[0.72]"
        />
      ) : (
        <>
          {/* Overcast Pale-Sage Sky Bloom fading to Dark Olive Smoke */}
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse 95% 65% at 58% 22%, #dde6d8 0%, #99a894 28%, #475744 58%, #101811 84%, #050806 100%)',
            }}
          />

          {/* Subtle Desaturated Battlefield Recon Texture */}
          <div
            className="home-hero-drift absolute inset-0 bg-cover bg-center opacity-[0.14] grayscale contrast-125 mix-blend-overlay"
            style={{ backgroundImage: 'url(/assets/fmv-recon.jpg)' }}
          />

          {/* Art-Directed CoD4 Key Art: Helicopters, Tactical Operator & Squad Silhouettes */}
          <svg
            viewBox="0 0 1600 900"
            preserveAspectRatio="xMidYMid slice"
            className="home-hero-drift absolute inset-0 h-full w-full"
          >
            <defs>
              <linearGradient id="codFogFade" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#121c13" stopOpacity="0.92" />
                <stop offset="58%" stopColor="#0a110b" stopOpacity="0.96" />
                <stop offset="100%" stopColor="#050806" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="rimLight" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#c7d5c2" stopOpacity="0.55" />
                <stop offset="55%" stopColor="#223023" stopOpacity="0.95" />
                <stop offset="100%" stopColor="#080d09" stopOpacity="1" />
              </linearGradient>
              <filter id="mistBlur" x="-15%" y="-15%" width="130%" height="130%">
                <feGaussianBlur stdDeviation="2.5" />
              </filter>
              <filter id="softGlow" x="-25%" y="-25%" width="150%" height="150%">
                <feGaussianBlur stdDeviation="14" />
              </filter>
            </defs>

            {/* Backlit Horizon Atmospheric Haze */}
            <ellipse cx="960" cy="340" rx="520" ry="260" fill="#e6efe3" opacity="0.34" filter="url(#softGlow)" />

            {/* Left Hovering Assault Helicopter + Fast-Rope Insertion */}
            <g transform="translate(215 170) scale(0.95)" opacity="0.62" filter="url(#mistBlur)">
              <ellipse cx="145" cy="18" rx="185" ry="7" fill="#182219" opacity="0.55" />
              <rect x="139" y="14" width="12" height="14" fill="#182219" />
              <path
                d="M78,34 C105,22 175,22 204,35 L292,38 L314,18 L322,20 L312,48 L220,52 C192,64 115,66 78,54 C62,48 64,38 78,34 Z"
                fill="#1b261c"
              />
              <path d="M110,60 L102,72 M176,60 L184,72 M95,72 L192,72" stroke="#1b261c" strokeWidth="3.5" />
              {/* Fast-rope + rappelling operators */}
              <line x1="126" y1="58" x2="124" y2="195" stroke="#1e291f" strokeWidth="2.5" />
              <ellipse cx="125" cy="118" rx="6" ry="13" fill="#1e291f" />
              <ellipse cx="124" cy="162" rx="6" ry="12" fill="#1e291f" />
            </g>

            {/* Right Hovering Gunship / Tiltrotor + Escort Drones */}
            <g transform="translate(1150 185) scale(1.05)" opacity="0.56" filter="url(#mistBlur)">
              <ellipse cx="145" cy="18" rx="195" ry="7" fill="#182219" opacity="0.5" />
              <rect x="139" y="14" width="12" height="14" fill="#182219" />
              <path
                d="M25,44 L106,40 C138,24 205,24 235,38 C252,46 250,58 232,62 L130,62 L32,52 L14,26 L22,24 Z"
                fill="#19231a"
              />
              <ellipse cx="320" cy="40" rx="22" ry="3.5" fill="#19231a" opacity="0.65" />
            </g>

            {/* Distant Autonomous Recon Quad-Drones */}
            <path d="M510 245 l18 5 l18 -5 l-18 8 z" fill="#1d281e" opacity="0.5" />
            <path d="M1070 290 l22 6 l22 -6 l-22 9 z" fill="#1d281e" opacity="0.45" />

            {/* Distant Jagged Ridge Line */}
            <path
              d="M0 640 L190 545 L390 585 L620 510 L860 555 L1120 490 L1380 540 L1600 475 L1600 900 L0 900 Z"
              fill="#111a12"
              opacity="0.72"
            />

            {/* Secondary Left & Right Advancing Squad Silhouettes */}
            <g opacity="0.5" filter="url(#mistBlur)" fill="#0e160f">
              <path d="M740 890 L752 680 L740 605 L766 575 L772 544 C772 528 798 528 798 544 L802 574 L832 602 L826 680 L842 890 Z" />
              <path d="M1260 890 L1275 688 L1264 612 L1292 582 L1298 552 C1298 536 1326 536 1326 552 L1330 580 L1362 612 L1350 692 L1368 890 Z" />
            </g>

            {/* Hero Central-Right Tactical Operator Silhouette (CoD4 Cover Pose) */}
            <g transform="translate(860 190)">
              {/* Helmet + Quad NVG Mount */}
              <path
                d="M174 34 C198 14 238 14 256 36 C264 46 266 64 258 76 L248 112 C230 124 196 124 180 112 L170 74 C166 58 168 42 174 34 Z"
                fill="url(#rimLight)"
              />
              {/* Flipped-up NVG optics */}
              <rect x="190" y="18" width="18" height="22" rx="4" fill="#172218" />
              <rect x="218" y="18" width="18" height="22" rx="4" fill="#172218" />
              <circle cx="199" cy="28" r="4" fill="#5ce696" opacity="0.65" />
              <circle cx="227" cy="28" r="4" fill="#5ce696" opacity="0.65" />

              {/* Combat Rig, Shoulders, Rifle Ready, Legs Dissolving into Smoke */}
              <path
                d="M142 126 C172 108 260 108 296 132 L346 186 L362 292 L322 332 L328 540 L256 540 L226 420 L198 540 L120 540 L126 324 L82 280 L108 174 Z"
                fill="url(#codFogFade)"
              />
              {/* Tactical Carbine held angled across chest */}
              <path
                d="M42 232 L268 186 L276 206 L210 222 L202 256 L180 260 L186 226 L124 238 L104 268 L84 264 L96 244 L44 250 Z"
                fill="#0b110c"
                stroke="#8aa38c"
                strokeOpacity="0.35"
                strokeWidth="2"
              />
            </g>
          </svg>
        </>
      )}

      {/* Drifting Volumetric Fog Layers */}
      <div
        className="home-fog-layer absolute -inset-x-12 bottom-0 h-2/3"
        style={{
          background:
            'radial-gradient(ellipse 80% 55% at 50% 92%, rgba(28, 40, 29, 0.85) 0%, rgba(16, 24, 17, 0.4) 55%, transparent 100%)',
        }}
      />

      {/* Ambient Battlefield Dust / Ash Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {/* Left & Bottom Contrast Scrim so Menu UI Always Pops Cleanly */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(95deg, rgba(5, 9, 6, 0.86) 0%, rgba(6, 11, 7, 0.56) 50%, rgba(5, 9, 6, 0.35) 100%), linear-gradient(180deg, rgba(6, 10, 7, 0.45) 0%, rgba(6, 10, 7, 0.12) 45%, rgba(4, 7, 5, 0.9) 100%)',
        }}
      />
    </div>
  );
}
