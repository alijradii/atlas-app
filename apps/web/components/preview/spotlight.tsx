"use client";

import { Button } from "@school2036/ui";
import { Sparkles } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Guide } from "./guidance";
import "./spotlight.css";

type Placement = {
  left: number;
  top: number;
  width: number;
  height: number;
  tipLeft: number;
  tipTop: number;
  tipWidth: number;
  tipMaxHeight: number;
  text: string;
  id: string;
};

/** Measurements follow layout and viewport events, never a perpetual animation loop. */
export function Spotlight({
  guide,
  onClose,
}: {
  guide: Guide;
  onClose: () => void;
}) {
  const [placement, setPlacement] = useState<Placement | null>(null);
  const [closing, setClosing] = useState(false);
  const tip = useRef<HTMLDivElement>(null);
  const dismiss = useRef<HTMLButtonElement>(null);
  const descriptionId = useId();
  const close = useCallback(() => setClosing(true), []);

  useEffect(() => {
    if (!closing) return;
    const timeout = window.setTimeout(
      onClose,
      matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 180,
    );
    return () => clearTimeout(timeout);
  }, [closing, onClose]);

  useEffect(() => {
    let frame = 0;
    let target: HTMLElement | null = null;
    let focused = false;
    let scrolled = false;
    let disposed = false;
    const previous = document.activeElement as HTMLElement | null;
    const heading = () =>
      document.querySelector<HTMLElement>("#main-content h1");
    const find = (id: string) => {
      if (id === "screen.heading") return heading();
      return (
        Array.from(
          document.querySelectorAll<HTMLElement>(
            `[data-guide-anchor="${CSS.escape(id)}"]`,
          ),
        ).find((element) => element.getClientRects().length > 0) ?? null
      );
    };
    const measure = () => {
      frame = 0;
      if (disposed) return;
      const direct = find(guide.id);
      const fallback = guide.fallback ? find(guide.fallback.id) : null;
      const next = direct ?? fallback ?? heading();
      if (!next) {
        onClose();
        return;
      }
      if (target !== next) {
        if (target) resize.unobserve(target);
        target = next;
        resize.observe(target);
      }
      const text =
        next === direct
          ? guide.text
          : next === fallback && guide.fallback
            ? guide.fallback.text
            : "That control isn’t available in the current state. This screen shows what needs to happen first.";
      const id =
        next === direct
          ? guide.id
          : next === fallback && guide.fallback
            ? guide.fallback.id
            : "screen.heading";
      const rect = next.getBoundingClientRect();
      const viewport = window.visualViewport;
      const viewLeft = viewport?.offsetLeft ?? 0,
        viewTop = viewport?.offsetTop ?? 0;
      const viewWidth = viewport?.width ?? innerWidth,
        viewHeight = viewport?.height ?? innerHeight;
      if (!scrolled) {
        scrolled = true;
        if (rect.top < viewTop + 80 || rect.bottom > viewTop + viewHeight - 200)
          next.scrollIntoView({
            block: "center",
            behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
              ? "instant"
              : "smooth",
          });
      }
      const tipWidth = Math.min(320, viewWidth - 24);
      const tipHeight = Math.min(
        tip.current?.offsetHeight || 180,
        viewHeight - 24,
      );
      const tipLeft = Math.max(
        viewLeft + 12,
        Math.min(viewLeft + viewWidth - tipWidth - 12, rect.left),
      );
      const below = rect.bottom + 22;
      const tipTop = Math.max(
        viewTop + 12,
        Math.min(
          viewTop + viewHeight - tipHeight - 12,
          below + tipHeight < viewTop + viewHeight - 12
            ? below
            : rect.top - 22 - tipHeight,
        ),
      );
      setPlacement({
        left: rect.left - 8,
        top: rect.top - 8,
        width: rect.width + 16,
        height: rect.height + 16,
        tipLeft,
        tipTop,
        tipWidth,
        tipMaxHeight: viewHeight - 24,
        text,
        id,
      });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    const viewportChanged = () => {
      scrolled = false;
      schedule();
    };
    const resize = new ResizeObserver(schedule);
    const content = document.querySelector("#main-content");
    if (content) resize.observe(content);
    const mutations = new MutationObserver(schedule);
    if (content) mutations.observe(content, { childList: true, subtree: true });
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    };
    const outside = (event: PointerEvent) => {
      if (!tip.current?.contains(event.target as Node)) close();
    };
    const focus = (event: FocusEvent) => {
      if (focused && !tip.current?.contains(event.target as Node)) close();
    };
    window.addEventListener("scroll", schedule, {
      passive: true,
      capture: true,
    });
    window.addEventListener("resize", viewportChanged);
    window.visualViewport?.addEventListener("resize", viewportChanged);
    window.visualViewport?.addEventListener("scroll", schedule);
    document.addEventListener("keydown", key);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", focus);
    measure();
    const focusFrame = requestAnimationFrame(() => {
      dismiss.current?.focus({ preventScroll: true });
      focused = true;
      if (tip.current) resize.observe(tip.current);
      schedule();
    });
    void document.fonts.ready.then(() => {
      if (!disposed) schedule();
    });
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      cancelAnimationFrame(focusFrame);
      resize.disconnect();
      mutations.disconnect();
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", viewportChanged);
      window.visualViewport?.removeEventListener("resize", viewportChanged);
      window.visualViewport?.removeEventListener("scroll", schedule);
      document.removeEventListener("keydown", key);
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", focus);
      if (
        document.activeElement === dismiss.current ||
        document.activeElement === document.body
      ) {
        const destination =
          previous?.isConnected && previous !== document.body
            ? previous
            : target?.isConnected && !target.matches(":disabled")
              ? target
              : heading();
        if (destination) {
          const old = destination.getAttribute("tabindex");
          destination.tabIndex = -1;
          destination.focus({ preventScroll: true });
          if (old === null)
            destination.addEventListener(
              "blur",
              () => destination.removeAttribute("tabindex"),
              { once: true },
            );
          else destination.setAttribute("tabindex", old);
        }
      }
    };
  }, [guide, onClose, close]);

  if (!placement) return null;
  return createPortal(
    <div className="atlas-spotlight" data-state={closing ? "closing" : "open"}>
      <div
        className="atlas-spotlight-ring"
        data-target={placement.id}
        aria-hidden="true"
        style={{
          left: placement.left,
          top: placement.top,
          width: placement.width,
          height: placement.height,
        }}
      />
      <div
        ref={tip}
        className="atlas-spotlight-tip"
        role="dialog"
        aria-label="Assistant tip"
        aria-describedby={descriptionId}
        style={{
          left: placement.tipLeft,
          top: placement.tipTop,
          width: placement.tipWidth,
          maxHeight: placement.tipMaxHeight,
        }}
      >
        <span className="atlas-spotlight-author">
          <Sparkles aria-hidden="true" size={13} />
          Here it is
        </span>
        <p id={descriptionId}>{placement.text}</p>
        <Button ref={dismiss} size="sm" onClick={close}>
          Got it
        </Button>
      </div>
    </div>,
    document.body,
  );
}
