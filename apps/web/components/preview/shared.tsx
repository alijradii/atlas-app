"use client";
import { Badge, Card, CardContent, CardHeader, cn } from "@school2036/ui";
import {
  BarChart3,
  BookOpen,
  Check,
  FileUp,
  Heart,
  Home,
  MessageCircle,
  Route,
  Settings2,
  ShieldCheck,
  SquarePen,
  UserRound,
  UsersRound,
  Video,
} from "lucide-react";
import { PearlScene } from "../pearl";
import { fixture, subjectName } from "./data";
import { usePreview } from "./state";

export const icons = {
  home: Home,
  path: Route,
  video: Video,
  chat: MessageCircle,
  pen: SquarePen,
  user: UserRound,
  users: UsersRound,
  heart: Heart,
  chart: BarChart3,
  upload: FileUp,
  shield: ShieldCheck,
  settings: Settings2,
};
export function Panel({
  title,
  children,
  action,
  className,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("gap-0 overflow-hidden py-0", className)}>
      <CardHeader className="flex flex-row items-center justify-between gap-3 border-b px-5 py-4">
        <h2 className="eyebrow">{title}</h2>
        {action}
      </CardHeader>
      <CardContent className="space-y-4 p-5">{children}</CardContent>
    </Card>
  );
}
export function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card px-5 py-4 text-sm text-muted-foreground">
      {children}
    </div>
  );
}
export function Status({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "success" | "warning";
}) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "max-w-full rounded-full px-2.5 py-1 text-xs",
        tone === "default" && "bg-accent text-cobalt",
        tone === "success" &&
          "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
        tone === "warning" &&
          "bg-amber-500/10 text-amber-900 dark:text-amber-200",
      )}
    >
      {children}
    </Badge>
  );
}
export function Hero({
  title,
  eyebrow,
  action,
  date,
}: {
  title: React.ReactNode;
  eyebrow: string;
  action?: React.ReactNode;
  date?: Date | null;
}) {
  return (
    <section className="pearl-home-hero">
      <div className="pearl-home-hero-copy">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {action}
      </div>
      <PearlScene className="pearl-home-hero-stage">
        {date && (
          <span className="pearl-home-date">
            {String(date.getDate()).padStart(2, "0")}
            <small>{date.toLocaleDateString("en", { month: "long" })}</small>
          </span>
        )}
      </PearlScene>
    </section>
  );
}
export { ActionCard } from "../pearl-home";
export function Evidence({ compact = false }: { compact?: boolean }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span>
          <i className="mr-2 inline-block size-2 rounded-full bg-cobalt" />
          On your own
        </span>
        <span>
          <i className="help-track mr-2 inline-block h-2 w-4 rounded" />
          With help
        </span>
      </div>
      {Object.entries(fixture.students.lina.progress)
        .slice(0, compact ? 3 : 8)
        .map(([key, p]) => (
          <div
            key={key}
            className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 text-sm"
          >
            <span>{subjectName(key)}</span>
            <span className="text-right">
              <b className="font-medium">{p.ind}%</b>
              <small className="ml-2 text-muted-foreground">
                {p.as}% with help
              </small>
            </span>
            <span className="relative col-span-2 h-2 overflow-hidden rounded-full bg-secondary">
              <span
                className="help-track absolute inset-y-0 left-0 rounded-full"
                style={{ width: `${p.as}%` }}
              />
              <span
                className="absolute inset-y-0 left-0 rounded-full bg-cobalt"
                style={{ width: `${p.ind}%` }}
              />
            </span>
          </div>
        ))}
    </div>
  );
}
export function Steps() {
  const { state, setState } = usePreview();
  return (
    <div className="divide-y">
      {fixture.students.lina.steps.map((step) => (
        <label
          key={step.id}
          className="flex cursor-pointer items-start gap-3 py-3"
        >
          <input
            type="checkbox"
            className="mt-1 size-4 accent-cobalt"
            checked={state.completed.includes(step.id)}
            onChange={() =>
              setState((s) => ({
                ...s,
                completed: s.completed.includes(step.id)
                  ? s.completed.filter((x) => x !== step.id)
                  : [...s.completed, step.id],
              }))
            }
          />
          <span
            className={cn(
              state.completed.includes(step.id) &&
                "text-muted-foreground line-through",
            )}
          >
            {step.txt}
            <small className="block text-muted-foreground no-underline">
              {step.owner}
            </small>
          </span>
        </label>
      ))}
    </div>
  );
}
export function Pipeline({ status }: { status: string }) {
  const stages = ["adviser", "parent", "school", "agreed"];
  const current = stages.indexOf(status);
  return (
    <ol className="grid gap-3 sm:grid-cols-4">
      {["Advisor review", "Parent review", "School confirms", "Confirmed"].map(
        (stage, i) => (
          <li key={stage} className="flex items-center gap-2 text-xs">
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full border",
                i <= current
                  ? "border-cobalt bg-accent text-cobalt"
                  : "text-muted-foreground",
              )}
            >
              {i < current ? <Check className="size-3" /> : i + 1}
            </span>
            {stage}
          </li>
        ),
      )}
    </ol>
  );
}
export function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="space-y-3 py-10 text-center">
      <BookOpen className="mx-auto size-7 text-cobalt" />
      <h2 className="text-xl">{title}</h2>
      <p className="mx-auto max-w-md text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
