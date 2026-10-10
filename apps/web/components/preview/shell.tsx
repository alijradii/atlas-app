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
  House,
  Menu,
  MoreHorizontal,
  School,
  Send,
  SquarePen,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
    <div className="min-h-screen">
      <aside
        className="pearl-panel fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r p-3 lg:flex"
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
          <p className="mr-auto text-xs text-muted-foreground">
            Design preview{" "}
            <span className="hidden sm:inline">
              · sample interactions, no school records
            </span>
          </p>
          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                className="gap-2 text-xs normal-case tracking-normal"
              >
                {state.school ? <School /> : <House />}
                {state.school ? "At school" : "From home"}
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
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant={!state.school ? "default" : "outline"}
                  onClick={() => setState((s) => ({ ...s, school: false }))}
                >
                  From home
                </Button>
                <Button
                  variant={state.school ? "default" : "outline"}
                  onClick={() => setState((s) => ({ ...s, school: true }))}
                >
                  At school
                </Button>
              </div>
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
        <main
          id="main-content"
          className="mx-auto grid max-w-[1280px] gap-7 px-5 pt-2 pb-12 sm:px-8 xl:px-14"
        >
          {children}
        </main>
        {section === "home" && !(accountId === "sami" && !state.onboarded) && (
          <div className="sticky bottom-4 z-10 mx-auto max-w-3xl px-5 pb-1">
            <form
              aria-label="Preview assistant"
              className="rounded-[28px] border border-input bg-surface p-4 shadow-pearl"
              onSubmit={(event) => {
                event.preventDefault();
                if (prompt.trim()) {
                  router.push(
                    `${base}chat?prompt=${encodeURIComponent(prompt.trim())}`,
                  );
                  setPrompt("");
                }
              }}
            >
              <label htmlFor="workspace-prompt" className="sr-only">
                Ask the preview assistant
              </label>
              <input
                id="workspace-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full min-w-0 bg-transparent px-1 py-2 outline-none"
                placeholder={
                  role === "student"
                    ? "Ask about a lesson, a problem, or your subjects"
                    : "Ask about your workspace"
                }
              />
              <div className="mt-2 flex items-center gap-3">
                <span className="flex-1 px-1 text-xs text-muted-foreground">
                  Scripted preview · advice and decisions stay with people.
                </span>
                <Button
                  type="submit"
                  size="icon"
                  disabled={!prompt.trim()}
                  aria-label="Send to preview assistant"
                >
                  <Send />
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
