"use client";

import { ApiError, api, type components } from "@school2036/api-client";
import { Button } from "@school2036/ui";
import { X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { AssistantDock } from "../preview/assistant-dock";
import { Composer } from "../preview/composer";
import type { Guide } from "../preview/guidance";
import { RichMessage } from "../preview/rich-message";
import { Spotlight } from "../preview/spotlight";
import type { Session } from "../workspace/types";
import "./assistant.css";

type Reply = components["schemas"]["AssistantView"];
type Guidance = NonNullable<Reply["guidance"]>;
type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  guidance?: Guidance | null;
};
type Registration = { token: symbol; session: Session; section: string };
type Context = {
  register: (session: Session, section: string) => () => void;
  reset: () => void;
  host: HTMLDivElement | null;
  setStudy: (active: boolean) => void;
  minimize: () => void;
  openStudy: () => void;
};
const AssistantContext = createContext<Context | null>(null);
const anchors = new Set([
  "files.upload",
  "study.sources",
  "study.transcript",
  "study.composer",
  "lessons.search",
  "schoolwork.assignments",
  "advisor.ask",
  "proposals.list",
  "students.list",
  "account.security",
  "home.overview",
]);
const routes = new Set([
  "/workspace",
  "/workspace?section=work",
  "/workspace?section=lessons",
  "/workspace?section=messages",
  "/workspace?section=plans",
  "/workspace?section=students",
  "/files",
  "/study",
  "/account",
]);
const defaults = [
  "Upload a document or recording",
  "Review my transcripts",
  "Help me understand my lesson",
];
function currentScreen() {
  const path = window.location.pathname;
  const section = new URLSearchParams(window.location.search).get("section");
  const candidate =
    path === "/workspace" && section ? `${path}?section=${section}` : path;
  return routes.has(candidate) ? candidate : "/workspace";
}
function safeGuide(value: Guidance | null | undefined) {
  return value && routes.has(value.route) && anchors.has(value.anchor)
    ? value
    : null;
}

/** Account-bound memory and one dock survive Next page transitions. No chat enters browser storage. */
export function AssistantProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [registration, setRegistration] = useState<Registration | null>(null);
  const identity = useRef<string | null>(null);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [suggestions, setSuggestions] = useState(defaults);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [study, setStudyActive] = useState(false);
  const [mode, setMode] = useState<"atlas" | "study">("atlas");
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const [pendingGuide, setPendingGuide] = useState<Guidance | null>(null);
  const [guide, setGuide] = useState<Guide | null>(null);
  const request = useRef<AbortController | null>(null);
  const messagesEnd = useRef<HTMLDivElement>(null);
  const reset = useCallback(() => {
    request.current?.abort();
    request.current = null;
    setDraft("");
    setMessages([]);
    setSuggestions(defaults);
    setError("");
    setRetry("");
    setBusy(false);
    setGuide(null);
    setPendingGuide(null);
    setCollapsed(false);
    setMode("atlas");
  }, []);
  const register = useCallback(
    (session: Session, section: string) => {
      if (identity.current !== session.account_id) {
        reset();
        // Child layout effects can register the Study slot before this account
        // registration. Initialize from the screen after resetting private data,
        // without overriding the user's mode during same-account revalidation.
        setMode(section === "study" ? "study" : "atlas");
        identity.current = session.account_id;
      }
      const token = Symbol();
      setRegistration({ token, session, section });
      return () =>
        setRegistration((current) =>
          current?.token === token ? null : current,
        );
    },
    [reset],
  );
  const setStudy = useCallback((active: boolean) => {
    setStudyActive(active);
    setMode(active ? "study" : "atlas");
  }, []);
  const minimize = useCallback(() => setCollapsed(true), []);
  const openStudy = useCallback(() => {
    setMode("study");
    setCollapsed(false);
  }, []);
  useEffect(() => {
    if (!["/workspace", "/files", "/study", "/account"].includes(pathname)) {
      reset();
      identity.current = null;
      setRegistration(null);
    }
  }, [pathname, reset]);
  useEffect(() => {
    setCollapsed(window.matchMedia("(max-height: 600px)").matches);
    return () => request.current?.abort();
  }, []);
  useEffect(() => {
    if (messages.length || busy)
      messagesEnd.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length, busy]);
  const dismissGuide = useCallback(() => setGuide(null), []);
  function showGuidance(value: Guidance) {
    const safe = safeGuide(value);
    if (!safe) return;
    setGuide(null);
    setPendingGuide(safe);
    if (currentScreen() !== safe.route) router.push(safe.route);
  }
  useEffect(() => {
    if (!pendingGuide || !registration) return;
    let frame = 0;
    const find = () => {
      if (currentScreen() !== pendingGuide.route) return;
      const target = Array.from(
        document.querySelectorAll<HTMLElement>(
          `[data-guide-anchor="${CSS.escape(pendingGuide.anchor)}"]`,
        ),
      ).find((element) => element.getClientRects().length > 0);
      if (!target) return;
      setGuide({
        id: pendingGuide.anchor as Guide["id"],
        route: pendingGuide.route,
        text: pendingGuide.description,
      });
      setPendingGuide(null);
    };
    const observer = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(find);
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["hidden", "data-state"],
    });
    find();
    const timeout = window.setTimeout(() => setPendingGuide(null), 8000);
    return () => {
      clearTimeout(timeout);
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [pendingGuide, registration]);
  async function ask(text: string) {
    if (!registration || request.current || !text.trim()) return;
    const session = registration.session;
    const account = session.account_id;
    const controller = new AbortController();
    request.current = controller;
    const screen = currentScreen();
    const content = text.trim();
    setBusy(true);
    setError("");
    setRetry(content);
    setDraft(content);
    setGuide(null);
    setCollapsed(false);
    try {
      const reply = await api<Reply>(
        "/assistant/messages",
        "POST",
        {
          message: content,
          screen,
          history: messages
            .slice(-8)
            .map(({ role, content }) => ({ role, content })),
        },
        session.csrf,
        controller.signal,
      );
      if (controller.signal.aborted || identity.current !== account) return;
      const confirmed = await api<Session>(
        "/auth/me",
        "GET",
        undefined,
        undefined,
        controller.signal,
      );
      if (confirmed.account_id !== account) {
        reset();
        setRegistration(null);
        router.refresh();
        return;
      }
      const guidance = safeGuide(reply.guidance);
      setMessages(
        (old) =>
          [
            ...old,
            { id: crypto.randomUUID(), role: "user", content },
            {
              id: crypto.randomUUID(),
              role: "assistant",
              content: reply.answer,
              guidance,
            },
          ].slice(-12) as Message[],
      );
      setSuggestions((reply.suggestions ?? []).slice(0, 3));
      setDraft("");
      setRetry("");
      if (guidance && currentScreen() === screen) showGuidance(guidance);
    } catch (cause) {
      if (controller.signal.aborted) return;
      if (cause instanceof ApiError && cause.status === 401) {
        reset();
        setRegistration(null);
        router.push("/login");
        return;
      }
      setError(
        cause instanceof Error
          ? cause.message
          : "Atlas couldn’t answer. Please try again.",
      );
    } finally {
      if (request.current === controller) {
        request.current = null;
        setBusy(false);
      }
    }
  }
  const context = useMemo(
    () => ({ register, reset, host, setStudy, minimize, openStudy }),
    [register, reset, host, setStudy, minimize, openStudy],
  );
  return (
    <AssistantContext.Provider value={context}>
      {children}
      {registration && (
        <div
          className="atlas-global-assistant atlas-composer-wrap"
          data-guide-anchor="study.composer"
        >
          <AssistantDock collapsed={collapsed} onCollapsedChange={setCollapsed}>
            {(close) => (
              <>
                {study && (
                  <fieldset
                    className="atlas-assistant-modes"
                    aria-label="Assistant mode"
                  >
                    <button
                      type="button"
                      aria-pressed={mode === "study"}
                      onClick={() => setMode("study")}
                    >
                      Study session
                    </button>
                    <button
                      type="button"
                      aria-pressed={mode === "atlas"}
                      onClick={() => setMode("atlas")}
                    >
                      Ask Atlas
                    </button>
                  </fieldset>
                )}
                <div ref={setHost} hidden={!study || mode !== "study"} />
                <div hidden={study && mode === "study"}>
                  {(messages.length > 0 || busy || error) && (
                    <section
                      className="atlas-assistant-replies"
                      aria-label="Atlas conversation"
                    >
                      <div className="atlas-assistant-reply-header">
                        <span>Atlas</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Clear assistant conversation"
                          disabled={busy}
                          onClick={reset}
                        >
                          <X />
                        </Button>
                      </div>
                      <div
                        className="atlas-assistant-history"
                        role="log"
                        aria-live="polite"
                      >
                        {messages.map((message) => (
                          <div
                            key={message.id}
                            className={`atlas-assistant-reply atlas-assistant-reply-${message.role}`}
                          >
                            {message.role === "assistant" ? (
                              <RichMessage text={message.content} />
                            ) : (
                              <p>{message.content}</p>
                            )}
                            {message.guidance && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  showGuidance(message.guidance as Guidance)
                                }
                              >
                                Show me
                              </Button>
                            )}
                          </div>
                        ))}
                        <div ref={messagesEnd} />
                      </div>
                      {busy && (
                        <p className="atlas-assistant-working" role="status">
                          <span />
                          Finding the right help…
                        </p>
                      )}
                      {error && (
                        <div role="alert">
                          <p>{error}</p>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void ask(retry)}
                          >
                            Retry
                          </Button>
                        </div>
                      )}
                    </section>
                  )}
                  <Composer
                    value={draft}
                    onChange={setDraft}
                    onSubmit={(text) => void ask(text)}
                    onMinimize={close}
                    label="Ask the assistant"
                    placeholder="Ask about a lesson, a problem, or your workspace"
                    hint="Ask me where to go or what to do next."
                    suggestions={suggestions}
                    sendDisabled={busy}
                    moreOptions={[
                      {
                        label: "Upload documents or recordings",
                        href: "/files",
                      },
                      { label: "Your study library", href: "/study" },
                    ]}
                    action={
                      busy ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            request.current?.abort();
                            request.current = null;
                            setBusy(false);
                          }}
                        >
                          Stop
                        </Button>
                      ) : undefined
                    }
                  />
                </div>
              </>
            )}
          </AssistantDock>
        </div>
      )}
      {registration && guide && (
        <Spotlight guide={guide} onClose={dismissGuide} />
      )}
    </AssistantContext.Provider>
  );
}
export function useAssistant() {
  const value = useContext(AssistantContext);
  if (!value) throw new Error("AssistantProvider is required");
  return value;
}
export function useAssistantSession(session: Session, section: string) {
  const { register, reset } = useAssistant();
  const { account_id, csrf, name, login, kind } = session;
  useLayoutEffect(
    () => register({ account_id, csrf, name, login, kind }, section),
    [register, account_id, csrf, name, login, kind, section],
  );
  return reset;
}
/** Study uses the same dock, with optional lesson sources and no duplicate prompt. */
export function StudyAssistantSlot({
  children,
}: {
  children: (minimize: () => void) => ReactNode;
}) {
  const { host, setStudy, minimize } = useAssistant();
  useLayoutEffect(() => {
    setStudy(true);
    return () => setStudy(false);
  }, [setStudy]);
  return host ? createPortal(children(minimize), host) : null;
}
