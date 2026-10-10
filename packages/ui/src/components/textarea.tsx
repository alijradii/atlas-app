"use client";

// Adapted from shadcn/ui (MIT), with Atlas Pearl tokens.
import * as React from "react";
import { cn } from "../lib/utils";

/** Grow with the draft, then scroll internally instead of covering the page. */
function Textarea({
  className,
  ref,
  style,
  onInput,
  ...props
}: React.ComponentProps<"textarea">) {
  const element = React.useRef<HTMLTextAreaElement>(null);
  React.useImperativeHandle(ref, () => element.current as HTMLTextAreaElement);
  const resize = React.useCallback(() => {
    const field = element.current;
    if (!field?.getClientRects().length) return;
    const computed = getComputedStyle(field);
    const border =
      Number.parseFloat(computed.borderTopWidth) +
      Number.parseFloat(computed.borderBottomWidth);
    field.style.height = "auto";
    field.style.height = `${field.scrollHeight + border}px`;
  }, []);
  // Includes controlled values, reset state and programmatically restored drafts.
  React.useLayoutEffect(resize);
  React.useEffect(() => {
    const field = element.current;
    if (!field) return;
    let width = field.clientWidth;
    const observer = new ResizeObserver(() => {
      if (field.clientWidth !== width) {
        width = field.clientWidth;
        resize();
      }
    });
    observer.observe(field);
    let resetFrame = 0;
    const reset = () => {
      cancelAnimationFrame(resetFrame);
      resetFrame = requestAnimationFrame(resize);
    };
    field.form?.addEventListener("reset", reset);
    window.addEventListener("resize", resize);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(resetFrame);
      field.form?.removeEventListener("reset", reset);
      window.removeEventListener("resize", resize);
    };
  }, [resize]);
  return (
    <textarea
      data-slot="textarea"
      ref={element}
      className={cn(
        "flex min-h-16 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:aria-invalid:ring-destructive/40",
        className,
      )}
      style={{
        maxHeight: "min(20rem, 45dvh)",
        ...style,
        resize: "none",
        overflowY: "auto",
      }}
      onInput={(event) => {
        resize();
        onInput?.(event);
      }}
      {...props}
    />
  );
}

export { Textarea };
