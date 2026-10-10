"use client";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  Switch,
} from "@school2036/ui";
import {
  Menu,
  MoreHorizontal,
  Pin,
  SlidersHorizontal,
  SquarePen,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AssistantDock } from "./assistant-dock";
import { Composer } from "./composer";
import { resolveGuide } from "./guidance";
import "./workspace.css";
import { Brand } from "../pearl";
import { ThemeToggle } from "../theme-toggle";
import {
  type AccountId,
  accounts,
  fixture,
  initials,
  navigation,
  type Role,
  roleNames,
} from "./data";
import { icons } from "./shared";
import { usePreview } from "./state";

export function WorkspaceShell({
  accountId,
  section,
  children,
  onNewChat,
}: {
  accountId: AccountId;
  section: string;
  children: React.ReactNode;
  onNewChat: () => void;
}) {
  const account = fixture.accounts[accountId];
  const role = account.role as Role;
  const { state, setState, reset } = usePreview();
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [pinPending, setPinPending] = useState(false);
  const [wasPinned, setWasPinned] = useState(false);
  const [toast, setToast] = useState(false);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(false), 7000);
    return () => window.clearTimeout(timer);
  }, [toast]);
  const suggestions: Record<Role, string[]> = {
    student: [
      "Where do I submit my batch?",
      "Make flashcards from my mistakes",
      "Pin Mass vs weight to my home",
    ],
    teacher: [
      "Where do I upload a lesson?",
      "Show me the evidence for misconceptions",
    ],
    adviser: ["Where do I send a recommendation?"],
    parent: ["Where do I review Lina's choice?"],
    staff: ["Where do I approve proposals?"],
  };
  const hints: Record<Role, string> = {
    student:
      "Help here counts as help. Your own work is measured in practice batches.",
    teacher:
      "Answers point you to evidence. Your teaching decisions stay yours.",
    adviser: "AI answers are marked. Your advice stays your own.",
    parent: "You see what the school shares with families.",
    staff: "Answers summarise; decisions stay with staff.",
  };
  function ask(text: string) {
    setPrompt("");
    const guide = resolveGuide(accountId, text, state);
    if (guide) {
      router.push(`${guide.route}?guide=${encodeURIComponent(text)}`);
    } else if (role === "student" && /\bpin\b/i.test(text)) {
      setPinPending(true);
    } else {
      router.push(
        `/preview/${accountId}/chat?prompt=${encodeURIComponent(text)}`,
      );
    }
  }
  function pinLesson() {
    if (accountId !== "lina" && accountId !== "sami") return;
    setWasPinned(state.lessonPins[accountId].includes("L1"));
    setState((s) => ({
      ...s,
      lessonPins: {
        ...s.lessonPins,
        [accountId]: [...new Set([...s.lessonPins[accountId], "L1"])],
      },
    }));
    setPinPending(false);
    setToast(true);
  }
  const base = `/preview/${accountId}/`;
  const pins =
    accountId === "lina" || accountId === "sami"
      ? fixture.lessons.filter((lesson) =>
          state.lessonPins[accountId].includes(lesson.id),
        )
      : [];
  const nav = (
    <>
      <Brand className="px-3 py-7" />
      <nav aria-label="Workspace" className="mt-3 grid gap-1">
        {navigation[role].map(([id, label, icon]) => {
          const Icon = icons[icon as keyof typeof icons];
          return (
            <Link
              key={id}
              href={base + id}
              onClick={() => setMenu(false)}
              aria-current={
                section === id ||
                (section === "lesson" && id === "lessons") ||
                (section === "student" && id === "students")
                  ? "page"
                  : undefined
              }
              className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm text-muted-foreground transition-colors hover:bg-surface/60 aria-[current=page]:bg-surface aria-[current=page]:text-foreground aria-[current=page]:shadow-pearl"
            >
              <Icon className="size-4 shrink-0" />
              {label}
              {id === "practice" &&
                state.batch === "active" &&
                accountId === "lina" && (
                  <span className="ml-auto rounded-full bg-accent px-1.5 text-xs text-cobalt">
                    1
                  </span>
                )}
            </Link>
          );
        })}
      </nav>
      <Button asChild variant="outline" className="mt-7 w-full bg-transparent">
        <Link
          href={`${base}chat`}
          onClick={() => {
            setMenu(false);
            onNewChat();
          }}
        >
          <SquarePen />
          New chat
        </Link>
      </Button>
      {pins.length > 0 && (
        <nav aria-label="Pinned lessons" className="mt-6 grid gap-3 px-3">
          <p className="eyebrow">Pinned</p>
          {pins.map((lesson) => (
            <Link
              key={lesson.id}
              href={`${base}lesson/${lesson.id}`}
              className="text-xs text-muted-foreground"
              onClick={() => setMenu(false)}
            >
              {lesson.title}
            </Link>
          ))}
        </nav>
      )}
      <div className="mt-auto pt-10">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-auto w-full justify-start gap-3 rounded-xl px-3 py-3 text-left normal-case tracking-normal"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full border bg-surface text-xs">
                {initials(account.name)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm">{account.name}</span>
                <small className="block text-xs font-normal text-muted-foreground">
                  {roleNames[role]}
                </small>
              </span>
              <MoreHorizontal className="ml-auto shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" className="w-64">
            <DropdownMenuLabel>Switch preview account</DropdownMenuLabel>
            {accounts.map((a) => (
              <DropdownMenuItem key={a.id} asChild>
                <Link
                  href={`/preview/${a.id}/home`}
                  onClick={() => setMenu(false)}
                >
                  {a.name}
                </Link>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/files">Your private files</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/login">Exit preview</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <p className="px-3 pt-4 pb-3 text-[11px] leading-relaxed text-muted-foreground">
          Atlas Pearl
          <br />
          Preview · example data
        </p>
      </div>
    </>
  );
  return (
    <div className="atlas-workspace min-h-screen" data-section={section}>
      <aside
        className="pearl-panel fixed inset-y-0 left-0 z-20 hidden w-64 flex-col overflow-y-auto border-r p-3 lg:flex"
        aria-label="Main navigation"
      >
        {nav}
      </aside>
      <div className="lg:ml-64">
        <header className="flex min-h-20 flex-wrap items-center gap-3 px-5 py-4 sm:px-8">
          <Sheet open={menu} onOpenChange={setMenu}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="lg:hidden"
                aria-label="Open navigation"
              >
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="pearl-panel flex w-72 flex-col px-3"
            >
              <SheetHeader className="sr-only">
                <SheetTitle>Workspace navigation</SheetTitle>
                <SheetDescription>
                  Explore the Atlas role pages.
                </SheetDescription>
              </SheetHeader>
              {nav}
            </SheetContent>
          </Sheet>
          <span className="mr-auto" />
          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                className="gap-2 text-xs normal-case tracking-normal"
              >
                <SlidersHorizontal />
                Preview controls
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Preview scenario</DialogTitle>
                <DialogDescription>
                  Explore availability and empty states. These controls only
                  affect sample screens.
                </DialogDescription>
              </DialogHeader>
              {(
                [
                  ["tutor", "Study agent & feedback"],
                  ["video", "Video playback"],
                ] as const
              ).map(([key, label]) => (
                <label
                  htmlFor={`scenario-${key}`}
                  key={key}
                  className="flex items-center justify-between gap-4 py-2"
                >
                  {label}
                  <Switch
                    id={`scenario-${key}`}
                    checked={state[key]}
                    onCheckedChange={(checked) =>
                      setState((s) => ({ ...s, [key]: checked }))
                    }
                  />
                </label>
              ))}
              <Button variant="outline" onClick={reset}>
                Reset preview data
              </Button>
            </DialogContent>
          </Dialog>
          <ThemeToggle />
        </header>
        <main id="main-content" className="atlas-workspace-main">
          {children}
        </main>
        {section === "home" && !(accountId === "sami" && !state.onboarded) && (
          <div className="atlas-composer-wrap">
            <AssistantDock>
              {(minimize) => (
                <Composer
                  onMinimize={minimize}
                  value={prompt}
                  onChange={setPrompt}
                  onSubmit={ask}
                  label="Ask the assistant"
                  suggestions={suggestions[role]}
                  hint={hints[role]}
                  placeholder={
                    role === "student"
                      ? "Ask about a lesson, a problem, or your subjects"
                      : "Ask about your workspace"
                  }
                  moreOptions={[
                    { label: "Your private files", href: "/files" },
                    { label: "New conversation", href: `${base}chat` },
                  ]}
                >
                  {pinPending && (
                    <div className="atlas-pin-tray" role="status">
                      <Pin size={17} />
                      <span>
                        <small className="atlas-ai-label">
                          Suggested shortcut
                        </small>
                        Pin Mass vs weight to your home?
                      </span>
                      <Button onClick={pinLesson}>Pin to home</Button>
                      <button
                        type="button"
                        aria-label="Cancel pin"
                        onClick={() => setPinPending(false)}
                      >
                        <X size={18} />
                      </button>
                    </div>
                  )}
                </Composer>
              )}
            </AssistantDock>
          </div>
        )}
      </div>
      {toast && (
        <div className="atlas-toast" role="status">
          Pinned to your home.
          <button
            type="button"
            onClick={() => {
              if (!wasPinned && (accountId === "lina" || accountId === "sami"))
                setState((s) => ({
                  ...s,
                  lessonPins: {
                    ...s.lessonPins,
                    [accountId]: s.lessonPins[accountId].filter(
                      (id) => id !== "L1",
                    ),
                  },
                }));
              setToast(false);
            }}
          >
            Undo
          </button>
        </div>
      )}
    </div>
  );
}
