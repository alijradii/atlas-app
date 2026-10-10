"use client";

import { type ReactNode, useEffect, useRef } from "react";

/** CSS owns every animation frame; JavaScript only tracks scene visibility. */
export function AmbientScene({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    const update = () => {
      element.dataset.pearlScene =
        visible && !document.hidden && !preference.matches
          ? "running"
          : "paused";
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      update();
    });
    observer.observe(element);
    document.addEventListener("visibilitychange", update);
    preference.addEventListener("change", update);
    update();
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
      preference.removeEventListener("change", update);
    };
  }, []);
  return (
    <div
      ref={host}
      className={className}
      aria-hidden="true"
      data-pearl-scene="paused"
    >
      {children}
    </div>
  );
}
