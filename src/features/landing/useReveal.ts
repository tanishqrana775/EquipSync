/**
 * src/features/landing/useReveal.ts
 * EquipSync – IntersectionObserver scroll reveal hook.
 * Adds .reveal-active once when the element enters viewport.
 * Disabled under prefers-reduced-motion.
 */

import { useEffect, useRef } from 'react';

export function useReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.classList.add('reveal-active');
      return;
    }

    el.classList.add('reveal-init');

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('reveal-active');
          observer.unobserve(el);
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, []);

  return ref;
}
