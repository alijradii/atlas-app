"use client";

import {
  type ReactNode,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

/** Keep the composer mounted so minimizing never discards a draft or pending action. */
export function AssistantDock({
  children,
}: {
  children: (minimize: () => void) => ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const pane = useRef<HTMLDivElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const interacted = useRef(false);
  const id = useId();
  function minimize() {
    const panel = pane.current;
    const button = launcher.current;
    if (!panel || !button) return;
    interacted.current = true;
    setCollapsed(true);
  }
  useLayoutEffect(() => {
    const panel = pane.current;
    const button = launcher.current;
    if (!panel || !button || !panel.parentElement) return;
    const measure = () => {
      panel.style.setProperty(
        "--dock-travel",
        `${button.offsetLeft + button.offsetWidth - panel.offsetLeft - panel.offsetWidth}px`,
      );
      panel.style.setProperty(
        "--dock-scale-x",
        `${button.offsetWidth / panel.offsetWidth}`,
      );
      panel.style.setProperty(
        "--dock-scale-y",
        `${button.offsetHeight / panel.offsetHeight}`,
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(panel);
    observer.observe(panel.parentElement);
    measure();
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    if (!interacted.current) return;
    if (collapsed) launcher.current?.focus({ preventScroll: true });
    else
      pane.current?.querySelector("textarea")?.focus({ preventScroll: true });
  }, [collapsed]);
  return (
    <section
      aria-label="Atlas assistant dock"
      className="atlas-assistant-dock"
      data-collapsed={collapsed}
    >
      <div
        ref={pane}
        id={id}
        className="atlas-dock-pane"
        inert={collapsed}
        aria-hidden={collapsed}
        onKeyDown={(event) => {
          if (event.key === "Escape" && !event.defaultPrevented) {
            event.preventDefault();
            minimize();
          }
        }}
      >
        {children(minimize)}
      </div>
      <button
        ref={launcher}
        type="button"
        className="atlas-dock-launcher"
        aria-label="Open Atlas assistant"
        aria-expanded={!collapsed}
        aria-controls={id}
        inert={!collapsed}
        aria-hidden={!collapsed}
        onClick={() => {
          interacted.current = true;
          setCollapsed(false);
        }}
      >
        <span className="atlas-dock-orb" aria-hidden="true" />
        Ask Atlas
      </button>
    </section>
  );
}
