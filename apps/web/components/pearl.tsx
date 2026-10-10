import { cn } from "@school2036/ui";
import Link from "next/link";
import { AmbientScene } from "./ambient-scene";

export function Brand({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="Atlas home"
      className={cn(
        "atlas-brand inline-flex items-center gap-3 text-sm font-semibold tracking-[0.22em]",
        className,
      )}
    >
      <span
        className="obj blue rim relative! inline-block size-6 shrink-0"
        aria-hidden="true"
      />
      <span className="atlas-brand-name">ATLAS</span>
    </Link>
  );
}

export function PearlScene({
  className = "",
  compact = false,
  children,
}: {
  className?: string;
  compact?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <AmbientScene
      className={cn(
        "pearl-scene mist-panel relative isolate min-h-64 overflow-hidden",
        className,
      )}
    >
      <div className="haze right-[-14%] top-[10%] h-[60%] w-[60%]" />
      <div className="prism -bottom-[18%] -left-[6%] h-1/2 w-[70%] -rotate-14" />
      <svg
        aria-hidden="true"
        className="links-svg"
        viewBox="0 0 400 300"
        preserveAspectRatio="none"
      >
        <g stroke="rgba(255,255,255,.75)" strokeWidth="1" fill="none">
          <path d="M118 70 L150 150" />
          <path d="M150 150 L330 210" />
        </g>
      </svg>
      <span
        className={cn(
          "obj lens float d2 top-[6%] aspect-[.85] w-[34%] -rotate-18 scale-x-60",
          compact ? "left-[52%]" : "left-[44%]",
        )}
      />
      <span className="obj bubble core rim float left-[22%] top-[10%] aspect-square w-[15%]" />
      <span
        className={cn(
          "obj blue rim float d3 left-[20%] top-[38%] aspect-square",
          compact ? "w-[30%]" : "w-[34%]",
        )}
      />
      <span className="obj blue rim float d2 left-[74%] top-[56%] aspect-square w-[16%] saturate-[.85]" />
      <span className="obj lens float left-[68%] top-[44%] aspect-[.95] w-[15%] rotate-18 scale-x-70" />
      {children}
    </AmbientScene>
  );
}

export function PearlObject({
  kind = "blue",
  core = true,
  className = "",
}: {
  kind?: "blue" | "lens" | "bubble";
  core?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "obj pearl-object inline-block aspect-square",
        kind === "lens"
          ? "lens -rotate-18 scale-x-65"
          : kind === "bubble"
            ? `bubble ${core ? "core " : ""}rim`
            : "blue rim",
        className,
      )}
    />
  );
}

export function PageHeading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
        <h1 className="text-3xl sm:text-4xl">{title}</h1>
        {description && (
          <p className="mt-3 max-w-2xl text-base text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {children}
    </header>
  );
}
