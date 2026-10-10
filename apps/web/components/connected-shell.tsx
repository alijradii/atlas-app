"use client";

import { ApiError, api } from "@school2036/api-client";
import { Button } from "@school2036/ui";
import {
  CalendarDays,
  FileText,
  FileUp,
  Home,
  LogOut,
  MessageCircle,
  MoreHorizontal,
  Route,
  SquarePen,
  UserRound,
  UsersRound,
  Video,
} from "lucide-react";
import Link from "next/link";
import { type ReactNode, useEffect, useState } from "react";
import { useAssistant, useAssistantSession } from "./assistant/provider";
import { roleAssistant } from "./assistant/role-context";
import { Brand } from "./pearl";
import { PearlFrame, pearlNavLinkClass } from "./pearl-frame";
import { initials } from "./preview/data";
import { consumeStudyDraft } from "./study/draft-handoff";
import type { Session, Workspace } from "./workspace/types";

/** One Pearl frame for real accounts and the fixture-backed design examples. */
export function ConnectedShell({
  session,
  section,
  children,
  onSignOut,
  data,
  headerActions,
}: {
  session: Session;
  section: string;
  children: ReactNode;
  onSignOut?: () => void;
  data?: Workspace;
  headerActions?: ReactNode;
}) {
  const { openAtlas } = useAssistant();
  const [navigationData, setNavigationData] = useState<Workspace | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (data) return;
    let current: AbortController | null = null;
    const refresh = async () => {
      current?.abort();
      if (document.visibilityState === "hidden") return;
      const controller = new AbortController();
      current = controller;
      try {
        const next = await api<Workspace>(
          "/school/workspace",
          "GET",
          undefined,
          undefined,
          controller.signal,
        );
        if (
          !controller.signal.aborted &&
          next.account_id === session.account_id
        )
          setNavigationData(next);
      } catch (cause) {
        if (cause instanceof ApiError && [401, 403].includes(cause.status))
          setNavigationData(null);
        // Navigation is optional context. Each destination independently checks
        // its session and permissions; a failed lookup never grants a role.
      }
    };
    void refresh();
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      clearTimeout(timer);
      if (document.visibilityState !== "hidden")
        timer = setTimeout(refresh, 80);
    };
    window.addEventListener("focus", schedule);
    document.addEventListener("visibilitychange", schedule);
    return () => {
      current?.abort();
      clearTimeout(timer);
      window.removeEventListener("focus", schedule);
      document.removeEventListener("visibilitychange", schedule);
    };
  }, [session.account_id, data]);
  const workspace =
    data ??
    (navigationData?.account_id === session.account_id ? navigationData : null);
  const roles = workspace?.roles ?? [];
  const resetAssistant = useAssistantSession(session, section, roles);
  const assistant = roleAssistant(roles);
  const has = (role: Workspace["roles"][number]) => roles.includes(role);
  const navigation = [
    { id: "home", label: "Home", href: "/workspace", Icon: Home },
    ...(has("advisor")
      ? [
          {
            id: "students",
            label: "My students",
            href: "/workspace?section=students",
            Icon: UsersRound,
          },
        ]
      : []),
    ...(has("student") || has("teacher")
      ? [
          {
            id: "lessons",
            label: has("teacher") && !has("student") ? "My lessons" : "Lessons",
            href: "/workspace?section=lessons",
            Icon: Video,
          },
        ]
      : []),
    {
      id: assistant.role === "student" ? "study" : "assistant",
      label: assistant.title,
      href:
        assistant.role === "student"
          ? "/study"
          : "/workspace?section=assistant",
      Icon: MessageCircle,
    },
    { id: "files", label: "Files & recordings", href: "/files", Icon: FileUp },
    ...(has("student") || has("teacher") || has("parent")
      ? [
          {
            id: "work",
            label: "Schoolwork",
            href: "/workspace?section=work",
            Icon: SquarePen,
          },
        ]
      : []),
    ...(has("student") || has("advisor")
      ? [
          {
            id: "messages",
            label: has("student") ? "My advisor" : "Advisor conversations",
            href: "/workspace?section=messages",
            Icon: UserRound,
          },
        ]
      : []),
    ...(has("student") || has("advisor") || has("parent")
      ? [
          {
            id: "plans",
            label: has("parent")
              ? "Subject choices"
              : has("advisor")
                ? "Subject proposals"
                : "Subjects & path",
            href: "/workspace?section=plans",
            Icon: Route,
          },
        ]
      : []),
    ...(roles.length
      ? [
          {
            id: "events",
            label: "Events",
            href: "/workspace?section=events",
            Icon: CalendarDays,
          },
          {
            id: "reports",
            label: "Reports",
            href: "/workspace?section=reports",
            Icon: FileText,
          },
          {
            id: "connections",
            label: "Connections",
            href: "/workspace?section=connections",
            Icon: UsersRound,
          },
        ]
      : []),
  ];
  const roleOrder = has("student")
    ? [
        "home",
        "plans",
        "lessons",
        "study",
        "work",
        "messages",
        "students",
        "files",
      ]
    : has("teacher")
      ? [
          "home",
          "lessons",
          "files",
          "work",
          "students",
          "plans",
          "messages",
          "assistant",
        ]
      : has("advisor")
        ? [
            "home",
            "students",
            "plans",
            "messages",
            "assistant",
            "files",
            "work",
          ]
        : ["home", "plans", "work", "assistant", "files"];
  roleOrder.push("events", "connections", "reports");
  navigation.sort(
    (left, right) => roleOrder.indexOf(left.id) - roleOrder.indexOf(right.id),
  );
  async function signOut() {
    consumeStudyDraft(session.account_id);
    resetAssistant();
    if (onSignOut) return onSignOut();
    setSigningOut(true);
    setError("");
    try {
      await api("/auth/logout", "POST", undefined, session.csrf);
      // A full navigation also clears in-memory drafts from the previous session.
      window.location.assign("/login");
    } catch {
      setError("Could not sign out. Please try again.");
      setSigningOut(false);
    }
  }
  return (
    <PearlFrame
      section={section}
      navigation={(closeMenu) => (
        <>
          <Brand className="px-3 py-7" />
          <nav aria-label="Workspace" className="mt-3 grid gap-1">
            {navigation.map(({ id, href, label, Icon }) => (
              <Link
                key={id}
                href={href}
                className={pearlNavLinkClass}
                aria-current={section === id ? "page" : undefined}
                onClick={() => {
                  if (id === "assistant") openAtlas();
                  closeMenu();
                }}
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                {label}
              </Link>
            ))}
          </nav>
          <Button
            asChild
            variant="outline"
            className="mt-7 w-full bg-transparent"
          >
            <Link
              href={
                assistant.role === "student"
                  ? "/study?new=1"
                  : "/workspace?section=assistant"
              }
              onClick={() => {
                resetAssistant();
                if (assistant.role !== "student") openAtlas();
                closeMenu();
              }}
            >
              <SquarePen />
              New chat
            </Link>
          </Button>
          <div className="mt-auto pt-10">
            <Link
              href="/account"
              onClick={closeMenu}
              aria-label={`Account: ${session.name}`}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-surface/60"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full border bg-surface text-xs">
                {initials(session.name)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm">{session.name}</span>
                <small className="block text-xs text-muted-foreground">
                  {roles.length
                    ? roles
                        .map((role) => role[0].toUpperCase() + role.slice(1))
                        .join(" · ")
                    : "Your account"}
                </small>
              </span>
              <MoreHorizontal
                className="ml-auto size-4 shrink-0"
                aria-hidden="true"
              />
            </Link>
            <p className="px-3 pt-4 pb-3 text-[11px] leading-relaxed text-muted-foreground">
              Atlas Pearl
              <br />
              Your private workspace
            </p>
          </div>
        </>
      )}
      headerActions={
        <>
          {headerActions}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Sign out"
            disabled={signingOut}
            onClick={() => void signOut()}
          >
            <LogOut className="size-4" />
          </Button>
        </>
      }
    >
      {error && <p role="alert">{error}</p>}
      {children}
    </PearlFrame>
  );
}
