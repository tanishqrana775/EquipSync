/**
 * src/components/effects/RippleBackground.tsx
 * EquipSync – Concentric water ripple background canvas.
 * Spawns ripples upon pointerdown on non-interactive regions.
 * Never used inside /app routes.
 */

import React, { useRef, useEffect, useState } from 'react';

export type RippleIntensity = 'hero' | 'auth';

export interface RippleBackgroundProps {
  children?: React.ReactNode;
  className?: string;
  intensity?: RippleIntensity;
}

interface ActiveRipple {
  x: number;
  y: number;
  startTime: number;
  rings: number;
  maxRadius: number;
  duration: number;
  baseOpacity: number;
}

function readPrimaryColor(): string {
  if (typeof window === 'undefined') return 'hsl(221, 83%, 53%)';
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
  if (!raw) return 'hsl(221, 83%, 53%)';
  if (raw.startsWith('#') || raw.startsWith('rgb') || raw.startsWith('hsl')) return raw;
  return `hsl(${raw})`;
}

export function useRippleCanvas(
  wrapperRef: React.RefObject<HTMLDivElement>,
  canvasRef: React.RefObject<HTMLCanvasElement>,
  intensity: RippleIntensity = 'hero'
) {
  const ripplesRef = useRef<ActiveRipple[]>([]);
  const isVisibleRef = useRef<boolean>(true);
  const isDocumentVisibleRef = useRef<boolean>(true);
  const primaryColorRef = useRef<string>('hsl(221, 83%, 53%)');
  const animFrameIdRef = useRef<number | null>(null);

  useEffect(() => {
    // Check prefers-reduced-motion
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const wrapper = wrapperRef.current;
    const canvas = canvasRef.current;
    if (!wrapper || !canvas) return;

    primaryColorRef.current = readPrimaryColor();

    // 1. Observe theme class mutations on <html>
    const themeObserver = new MutationObserver(() => {
      primaryColorRef.current = readPrimaryColor();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style'],
    });

    // 2. Handle canvas sizing with devicePixelRatio
    let width = wrapper.clientWidth;
    let height = wrapper.clientHeight;

    const resizeCanvas = () => {
      if (!wrapper || !canvas) return;
      const dpr = window.devicePixelRatio || 1;
      width = wrapper.clientWidth;
      height = wrapper.clientHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
      }
    };
    resizeCanvas();

    const resizeObserver = new ResizeObserver(() => {
      resizeCanvas();
    });
    resizeObserver.observe(wrapper);

    // 3. Pause rendering when off-screen or tab hidden
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      isVisibleRef.current = entry.isIntersecting;
      if (entry.isIntersecting && isDocumentVisibleRef.current && ripplesRef.current.length > 0) {
        startAnimation();
      }
    });
    intersectionObserver.observe(wrapper);

    const onVisibilityChange = () => {
      isDocumentVisibleRef.current = !document.hidden;
      if (!document.hidden && isVisibleRef.current && ripplesRef.current.length > 0) {
        startAnimation();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    // 4. Ripple drawing loop with requestAnimationFrame
    const draw = () => {
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, width, height);

      const now = performance.now();
      const nextRipples: ActiveRipple[] = [];

      for (const r of ripplesRef.current) {
        const elapsed = now - r.startTime;
        let isAlive = false;

        for (let i = 0; i < r.rings; i++) {
          const ringElapsed = elapsed - i * 140;
          if (ringElapsed > 0 && ringElapsed < r.duration) {
            isAlive = true;
            const progress = ringElapsed / r.duration;
            // Cubic ease-out
            const eased = 1 - Math.pow(1 - progress, 3);
            const radius = r.maxRadius * eased;
            const opacity = r.baseOpacity * (1 - progress);

            ctx.save();
            ctx.beginPath();
            ctx.arc(r.x, r.y, radius, 0, Math.PI * 2);
            ctx.strokeStyle = primaryColorRef.current;
            ctx.globalAlpha = Math.max(0, opacity);
            ctx.lineWidth = Math.max(0.5, 2.5 * (1 - progress));
            ctx.stroke();
            ctx.restore();
          }
        }

        if (isAlive || elapsed < r.duration + r.rings * 140) {
          nextRipples.push(r);
        }
      }

      ripplesRef.current = nextRipples;

      if (
        nextRipples.length > 0 &&
        isVisibleRef.current &&
        isDocumentVisibleRef.current
      ) {
        animFrameIdRef.current = requestAnimationFrame(draw);
      } else {
        animFrameIdRef.current = null;
      }
    };

    const startAnimation = () => {
      if (animFrameIdRef.current === null) {
        animFrameIdRef.current = requestAnimationFrame(draw);
      }
    };

    // 5. Pointerdown handler on wrapper element
    const onPointerDown = (e: PointerEvent) => {
      // Ignore interactive targets
      const target = e.target as HTMLElement | null;
      if (
        target &&
        target.closest(
          'button, a, input, select, textarea, label, [role="button"], [data-no-ripple]'
        )
      ) {
        return;
      }

      const rect = wrapper.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Config based on intensity
      const rings = intensity === 'hero' ? 3 : 2;
      const maxRadius = intensity === 'hero' ? 220 : 150;
      const duration = intensity === 'hero' ? 1200 : 950;
      const baseOpacity = intensity === 'hero' ? 0.38 : 0.22;

      // Cap at 12 active ripples
      if (ripplesRef.current.length >= 12) {
        ripplesRef.current.shift();
      }

      ripplesRef.current.push({
        x,
        y,
        startTime: performance.now(),
        rings,
        maxRadius,
        duration,
        baseOpacity,
      });

      startAnimation();
    };

    wrapper.addEventListener('pointerdown', onPointerDown);

    return () => {
      wrapper.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      themeObserver.disconnect();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      if (animFrameIdRef.current !== null) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [wrapperRef, canvasRef, intensity]);
}

export function RippleBackground({
  children,
  className = '',
  intensity = 'hero',
}: RippleBackgroundProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const media = window.matchMedia('(prefers-reduced-motion: reduce)');
      setPrefersReducedMotion(media.matches);
      const listener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    }
  }, []);

  useRippleCanvas(wrapperRef, canvasRef, intensity);

  return (
    <div ref={wrapperRef} className={`relative isolate overflow-hidden ${className}`}>
      {!prefersReducedMotion && (
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className="absolute inset-0 z-0 pointer-events-none h-full w-full"
        />
      )}
      <div className="relative z-10 flex flex-col flex-1 justify-between w-full h-full">
        {children}
      </div>
    </div>
  );
}
