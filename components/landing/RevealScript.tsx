"use client";

import { useEffect } from "react";

/**
 * Scroll-reveal, ported 1:1 from the handoff prototype. Renders nothing.
 *
 * Content is visible by default (SSR / no-JS / crawlers). Only once this
 * mounts do we flag the `.lp` root with `js` — which is what the CSS keys the
 * initial `opacity:0` off — then reveal each `.reveal` as it scrolls in.
 * `prefers-reduced-motion` is handled in CSS (forces visible).
 */
export function RevealScript() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".lp");
    if (!root) return;
    root.classList.add("js");

    const els = root.querySelectorAll<HTMLElement>(".reveal:not(.in)");
    if (!("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("in"));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return null;
}
