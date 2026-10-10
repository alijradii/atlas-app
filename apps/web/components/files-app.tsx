"use client";

import { ApiError, api, type components } from "@school2036/api-client";
import { Button, Card, Input } from "@school2036/ui";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AuthFrame } from "./auth-frame";
import { ConnectedShell } from "./connected-shell";
import { FileLibrary } from "./file-library";

type Session = components["schemas"]["SessionView"];
type FileRecord = components["schemas"]["UploadView"];

export default function FilesApp({
  afterLogin = "/files",
}: {
  afterLogin?: "/files" | "/study" | "/workspace" | "/account";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const identity = useRef<Session | null>(null);
  const lastFiles = useRef<{ account: string; files: FileRecord[] } | null>(
    null,
  );
  const reads = useRef(0);
  const sessionChecks = useRef(0);
  const readAbort = useRef<AbortController | null>(null);
  const mutation = useRef(false);
  const writes = useRef(0);
  const [session, setSessionState] = useState<Session | null>(null);
  const setSession = useCallback((value: Session | null) => {
    identity.current = value;
    if (!value) lastFiles.current = null;
    setSessionState(value);
  }, []);
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionCheckFailed, setSessionCheckFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const invalidateReads = useCallback(() => {
    ++reads.current;
    readAbort.current?.abort();
  }, []);
  const report = useCallback(
    (cause: unknown) => {
      if (cause instanceof ApiError && cause.status === 401) {
        invalidateReads();
        setSession(null);
        setFiles([]);
      }
      if (cause instanceof ApiError && cause.status === 403) {
        lastFiles.current = null;
        setFiles([]);
      }
      setError(
        cause instanceof Error
          ? cause.message
          : "The request failed. Try again.",
      );
    },
    [invalidateReads, setSession],
  );

  const refresh = useCallback(async () => {
    invalidateReads();
    const version = reads.current;
    const controller = new AbortController();
    readAbort.current = controller;
    const current = () =>
      version === reads.current && !controller.signal.aborted;
    try {
      const next = await api<Session>(
        "/auth/me",
        "GET",
        undefined,
        undefined,
        controller.signal,
      );
      if (!current()) return;
      const previous = identity.current;
      if (previous?.account_id !== next.account_id) {
        ++writes.current;
        mutation.current = false;
        setBusy(false);
        lastFiles.current = null;
        setFiles([]);
        setError("");
      } else if (lastFiles.current?.account === next.account_id) {
        setFiles(lastFiles.current.files);
      }
      if (
        !previous ||
        previous.account_id !== next.account_id ||
        previous.csrf !== next.csrf ||
        previous.name !== next.name
      )
        setSession(next);
      const values = await api<FileRecord[]>(
        "/files",
        "GET",
        undefined,
        undefined,
        controller.signal,
      );
      if (current() && identity.current?.account_id === next.account_id) {
        lastFiles.current = { account: next.account_id, files: values };
        setFiles(values);
      }
    } catch (cause) {
      if (current()) throw cause;
    }
  }, [invalidateReads, setSession]);

  const checkSession = useCallback(async () => {
    const check = ++sessionChecks.current;
    setLoading(true);
    setSessionCheckFailed(false);
    setError("");
    try {
      await refresh();
    } catch (cause) {
      if (check !== sessionChecks.current) return;
      if (cause instanceof ApiError && cause.status === 401) {
        setSession(null);
        setFiles([]);
      } else {
        setSessionCheckFailed(true);
        report(cause);
      }
    } finally {
      if (check === sessionChecks.current) setLoading(false);
    }
  }, [refresh, report, setSession]);

  useEffect(() => {
    void checkSession();
    return () => {
      ++sessionChecks.current;
      invalidateReads();
    };
  }, [checkSession, invalidateReads]);

  useEffect(() => {
    if (!session) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const update = async () => {
      clearTimeout(timer);
      if (!active || document.visibilityState === "hidden") return;
      if (!mutation.current) await refresh().catch(report);
      if (active) timer = setTimeout(update, 5000);
    };
    let resumeTimer: ReturnType<typeof setTimeout> | undefined;
    const revisit = () => {
      clearTimeout(timer);
      clearTimeout(resumeTimer);
      if (document.visibilityState !== "hidden")
        resumeTimer = setTimeout(() => void update(), 80);
    };
    document.addEventListener("visibilitychange", revisit);
    window.addEventListener("focus", revisit);
    timer = setTimeout(update, 5000);
    return () => {
      active = false;
      clearTimeout(timer);
      clearTimeout(resumeTimer);
      document.removeEventListener("visibilitychange", revisit);
      window.removeEventListener("focus", revisit);
    };
  }, [session, refresh, report]);

  useEffect(() => {
    if (!loading && !sessionCheckFailed) {
      if (session && pathname === "/login") router.replace(afterLogin);
      if (!session && pathname === "/files")
        router.replace("/login?next=files");
    }
  }, [session, loading, sessionCheckFailed, pathname, router, afterLogin]);

  async function run(action: () => Promise<void>) {
    if (mutation.current) return;
    mutation.current = true;
    const write = ++writes.current;
    const actor = identity.current?.account_id;
    invalidateReads();
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (cause) {
      if (write === writes.current && actor === identity.current?.account_id)
        report(cause);
    } finally {
      if (write === writes.current) {
        mutation.current = false;
        setBusy(false);
      }
    }
  }

  const redirecting =
    !sessionCheckFailed &&
    ((session && pathname === "/login") || (!session && pathname === "/files"));
  if (loading || redirecting)
    return (
      <main id="main-content" className="grid min-h-screen place-items-center">
        <p role="status">Loading…</p>
      </main>
    );

  if (sessionCheckFailed)
    return (
      <main
        id="main-content"
        className="grid min-h-screen place-items-center p-6"
      >
        <Card className="max-w-md space-y-4 p-7">
          <h1 className="text-2xl">Unable to load your session</h1>
          <p role="alert">{error}</p>
          <Button onClick={() => void checkSession()}>Try again</Button>
        </Card>
      </main>
    );

  const errorMessage = error && (
    <p
      className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
      role="alert"
    >
      {error}
    </p>
  );
  if (!session)
    return (
      <AuthFrame>
        {errorMessage}
        <form
          className="mt-5 grid gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const data = new FormData(form);
            void run(async () => {
              setSession(
                await api<Session>("/auth/login", "POST", {
                  login: data.get("login"),
                  password: data.get("password"),
                }),
              );
              form.reset();
            });
          }}
        >
          <label
            htmlFor="auth-login"
            className="grid gap-2 text-sm font-medium"
          >
            Login
            <Input
              id="auth-login"
              name="login"
              autoComplete="username"
              required
              maxLength={100}
            />
          </label>
          <label
            htmlFor="auth-password"
            className="grid gap-2 text-sm font-medium"
          >
            Password
            <Input
              id="auth-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={256}
            />
          </label>
          <Button type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </AuthFrame>
    );
  return (
    <ConnectedShell
      session={session}
      section="files"
      onSignOut={() =>
        void run(async () => {
          await api("/auth/logout", "POST", undefined, session.csrf);
          setSession(null);
          setFiles([]);
        })
      }
    >
      <div className="grid w-full gap-6">
        <div>
          <p className="eyebrow mb-4">Your private workspace</p>
          <h1 className="text-4xl">Your files</h1>
        </div>
        {errorMessage}
        <p>Signed in as {session.name}. Files are private to your account.</p>
        <FileLibrary
          key={session.account_id}
          session={session}
          files={files}
          refresh={refresh}
          report={report}
          busy={busy}
          run={run}
        />
      </div>
    </ConnectedShell>
  );
}
