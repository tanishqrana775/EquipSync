/**
 * src/components/effects/FloatingWidgets.tsx
 * EquipSync – Illustrative Floating Status Badges for Auth & Entry Pages.
 * 4 cards with no names or numbers: Booking approved, QR matched, Photo hash verified, Waitlist update.
 * Mouse parallax driven by requestAnimationFrame without React state per frame.
 * Automatically disabled on touch and prefers-reduced-motion.
 */

import React, { useEffect, useRef } from 'react';
import { CheckCircle2, QrCode, ShieldCheck, Clock } from 'lucide-react';
import '@/styles/entry.css';

export function FloatingWidgets() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mousePos = useRef({ x: 0, y: 0 });
  const targetPos = useRef({ x: 0, y: 0 });
  const rafId = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check touch devices or prefers-reduced-motion
    const isTouch = window.matchMedia('(pointer: coarse)').matches;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (isTouch || prefersReducedMotion) return;

    const onMouseMove = (e: MouseEvent) => {
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      targetPos.current = {
        x: (e.clientX - centerX) / centerX,
        y: (e.clientY - centerY) / centerY,
      };
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });

    const updateParallax = () => {
      // Lerp for smooth spring-like feel
      mousePos.current.x += (targetPos.current.x - mousePos.current.x) * 0.08;
      mousePos.current.y += (targetPos.current.y - mousePos.current.y) * 0.08;

      if (containerRef.current) {
        containerRef.current.style.setProperty('--mouse-x', mousePos.current.x.toFixed(4));
        containerRef.current.style.setProperty('--mouse-y', mousePos.current.y.toFixed(4));
      }
      rafId.current = requestAnimationFrame(updateParallax);
    };

    rafId.current = requestAnimationFrame(updateParallax);

    // Pause animation when tab is inactive
    const onVisibilityChange = () => {
      if (containerRef.current) {
        containerRef.current.setAttribute('data-tab-hidden', document.hidden ? 'true' : 'false');
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="hidden lg:block absolute inset-0 pointer-events-none select-none overflow-hidden z-0"
      style={{
        transform: 'translate3d(calc(var(--mouse-x, 0) * 12px), calc(var(--mouse-y, 0) * 12px), 0)',
      }}
    >
      {/* 1. Booking approved */}
      <div
        className="drift-card-1 absolute top-[18%] left-[8%] xl:left-[12%] flex items-center gap-2.5 px-3.5 py-2 rounded-xl border border-emerald-500/30 bg-card/85 text-foreground backdrop-blur-md shadow-lg"
        style={{
          transform: 'translate3d(calc(var(--mouse-x, 0) * -18px), calc(var(--mouse-y, 0) * -18px), 0)',
        }}
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4" />
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-bold leading-tight">Booking approved</span>
          <span className="text-[10px] text-muted-foreground font-medium">Ready for collection</span>
        </div>
      </div>

      {/* 2. QR matched */}
      <div
        className="drift-card-2 absolute bottom-[22%] left-[6%] xl:left-[10%] flex items-center gap-2.5 px-3.5 py-2 rounded-xl border border-primary/30 bg-card/85 text-foreground backdrop-blur-md shadow-lg"
        style={{
          transform: 'translate3d(calc(var(--mouse-x, 0) * -24px), calc(var(--mouse-y, 0) * 20px), 0)',
        }}
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <QrCode className="h-4 w-4" />
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-bold leading-tight">QR matched</span>
          <span className="text-[10px] text-muted-foreground font-medium">Physical asset confirmed</span>
        </div>
      </div>

      {/* 3. Photo hash verified */}
      <div
        className="drift-card-3 absolute top-[20%] right-[8%] xl:right-[12%] flex items-center gap-2.5 px-3.5 py-2 rounded-xl border border-blue-500/30 bg-card/85 text-foreground backdrop-blur-md shadow-lg"
        style={{
          transform: 'translate3d(calc(var(--mouse-x, 0) * 22px), calc(var(--mouse-y, 0) * -16px), 0)',
        }}
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400">
          <ShieldCheck className="h-4 w-4" />
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-bold leading-tight">Photo hash verified</span>
          <span className="text-[10px] text-muted-foreground font-medium">SHA-256 integrity intact</span>
        </div>
      </div>

      {/* 4. Waitlist update */}
      <div
        className="drift-card-4 absolute bottom-[24%] right-[6%] xl:right-[10%] flex items-center gap-2.5 px-3.5 py-2 rounded-xl border border-amber-500/30 bg-card/85 text-foreground backdrop-blur-md shadow-lg"
        style={{
          transform: 'translate3d(calc(var(--mouse-x, 0) * 20px), calc(var(--mouse-y, 0) * 24px), 0)',
        }}
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
          <Clock className="h-4 w-4" />
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-bold leading-tight">Waitlist update</span>
          <span className="text-[10px] text-muted-foreground font-medium">Slot offered automatically</span>
        </div>
      </div>
    </div>
  );
}

export default FloatingWidgets;
