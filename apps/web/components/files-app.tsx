"use client";

import { ApiError, api, type components } from "@school2036/api-client";
import { Button, Card, Input } from "@school2036/ui";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AuthFrame } from "./auth-frame";
import { Brand } from "./pearl";
import { ThemeToggle } from "./theme-toggle";

type Session = components["schemas"]["SessionView"];
type FileRecord = components["schemas"]["UploadView"];
type MediaType = components["schemas"]["UploadInput"]["media_type"];
const mediaTypes: MediaType[] = [
  "text/plain",
  "application/pdf",
  "image/png",
  "image/jpeg",
];

export default function FilesApp() {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null);
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionCheckFailed, setSessionCheckFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const report = useCallback((cause: unknown) => {
    if (cause instanceof ApiError && cause.status === 401) {
      setSession(null);
      setFiles([]);
    }
    setError(
      cause instanceof Error ? cause.message : "The request failed. Try again.",
    );
  }, []);

  const refresh = useCallback(
    async () => setFiles(await api<FileRecord[]>("/files")),
    [],
  );

  const checkSession = useCallback(() => {
    setLoading(true);
    setSessionCheckFailed(false);
    setError("");
    return api<Session>("/auth/me")
      .then(setSession)
      .catch((cause) => {
        if (cause instanceof ApiError && cause.status === 401) {
          setSession(null);
        } else {
          setSessionCheckFailed(true);
          report(cause);
        }
      })
      .finally(() => setLoading(false));
  }, [report]);

  useEffect(() => {
    void checkSession();
  }, [checkSession]);

  useEffect(() => {
    if (!session) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pending: AbortController | undefined;
    const pause = () => {
      clearTimeout(timer);
      pending?.abort();
      pending = undefined;
    };
    const update = () => {
      pause();
      if (!active || document.visibilityState === "hidden") return;
      const controller = new AbortController();
      pending = controller;
      void api<FileRecord[]>(
        "/files",
        "GET",
        undefined,
        undefined,
        controller.signal,
      )
        .then((value) => {
          if (active && !controller.signal.aborted) setFiles(value);
        })
        .catch((cause) => {
          if (active && !controller.signal.aborted) report(cause);
        })
        .finally(() => {
          if (active && pending === controller && !controller.signal.aborted) {
            pending = undefined;
            timer = setTimeout(update, 5000);
          }
        });
    };
    // Background polling must not continually renew an unattended session.
    // Resume immediately on return, letting the API enforce session expiry.
    document.addEventListener("visibilitychange", update);
    update();
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", update);
      pause();
    };
  }, [session, report]);

  useEffect(() => {
    if (!loading && !sessionCheckFailed) {
      if (session && pathname === "/login") router.replace("/files");
      if (!session && pathname === "/files") router.replace("/login");
    }
  }, [session, loading, sessionCheckFailed, pathname, router]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (cause) {
      report(cause);
    } finally {
      setBusy(false);
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
              maxLength={128}
            />
          </label>
          <Button type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </AuthFrame>
    );
  return (
    <div className="min-h-screen p-5 sm:p-8">
      <header className="mx-auto flex max-w-6xl flex-wrap items-center gap-4">
        <Brand />
        <div className="ml-auto flex items-center gap-3">
          <Button asChild variant="ghost">
            <Link href="/preview/lina/home">Explore preview</Link>
          </Button>
          <ThemeToggle />
          <Button
            variant="outline"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await api("/auth/logout", "POST", undefined, session.csrf);
                setSession(null);
                setFiles([]);
              })
            }
          >
            Sign out
          </Button>
        </div>
      </header>
      <main id="main-content" className="mx-auto grid max-w-4xl gap-6 py-12">
        <div>
          <p className="eyebrow mb-4">Your private workspace</p>
          <h1 className="text-4xl">Your files</h1>
        </div>
        {errorMessage}
        <p>Signed in as {session.name}. Files are private to your account.</p>
        <Card className="p-6 sm:p-8">
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const file = new FormData(form).get("file");
              if (!(file instanceof File) || !file.size) {
                setError("Choose a non-empty file.");
                return;
              }
              void run(async () => {
                if (file.size > 10 * 1024 * 1024)
                  throw new Error("Files must be 10 MB or smaller.");
                const mediaType = file.type as MediaType;
                if (!mediaTypes.includes(mediaType))
                  throw new Error("Choose a TXT, PDF, PNG or JPEG file.");
                const bytes = await file.arrayBuffer();
                const hash = await crypto.subtle.digest("SHA-256", bytes);
                const checksum = Array.from(new Uint8Array(hash), (byte) =>
                  byte.toString(16).padStart(2, "0"),
                ).join("");
                const upload = await api<FileRecord>(
                  "/uploads",
                  "POST",
                  {
                    filename: file.name,
                    media_type: mediaType,
                    size: file.size,
                    checksum,
                  },
                  session.csrf,
                );
                if (!upload.url) throw new Error("No upload URL was returned.");
                const local = upload.url.startsWith("/api/v1/uploads/");
                const response = await fetch(upload.url, {
                  method: "PUT",
                  body: bytes,
                  credentials: local ? "same-origin" : "omit",
                  headers: {
                    "Content-Type": mediaType,
                    ...(local ? { "X-CSRF-Token": session.csrf } : {}),
                  },
                });
                if (!response.ok)
                  throw new Error(
                    "Upload failed. Remove the pending file and try again.",
                  );
                await api(
                  `/uploads/${upload.id}/complete`,
                  "POST",
                  undefined,
                  session.csrf,
                );
                form.reset();
                await refresh();
              });
            }}
          >
            <label
              htmlFor="auth-file"
              className="grid gap-2 text-sm font-medium"
            >
              Choose a file
              <Input
                id="auth-file"
                name="file"
                type="file"
                accept=".txt,.pdf,.png,.jpg,.jpeg"
                required
                aria-describedby="file-help"
              />
            </label>
            <small id="file-help" className="text-muted-foreground">
              TXT, PDF, PNG or JPEG, up to 10 MB. Files are available after
              verification.
            </small>
            <Button type="submit" disabled={busy}>
              {busy ? "Working…" : "Upload"}
            </Button>
          </form>
        </Card>
        {!files.length && (
          <Card className="p-10 text-center">
            <h2 className="text-xl">No files yet.</h2>
            <p className="text-sm text-muted-foreground">
              Add a document or image to get started.
            </p>
          </Card>
        )}
        <ul aria-label="Your files" className="space-y-3">
          {files.map((file) => (
            <li
              key={file.id}
              className="glass-panel flex flex-wrap items-center justify-between gap-4 p-5"
            >
              <div className="grid min-w-0 flex-1 basis-48 gap-1 break-all">
                <strong>{file.filename}</strong>
                <small>
                  {Math.ceil(file.size / 1024)} KB · {file.state}
                </small>
                {file.error && (
                  <span className="text-sm text-destructive">{file.error}</span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {file.state === "accepted" && (
                  <a
                    className="text-sm text-cobalt underline underline-offset-4"
                    href={`/api/v1/files/${file.id}/download`}
                  >
                    Download {file.filename}
                  </a>
                )}
                {["pending", "queued", "quarantined"].includes(file.state) && (
                  <Button
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await api(
                          `/uploads/${file.id}/complete`,
                          "POST",
                          undefined,
                          session.csrf,
                        );
                        await refresh();
                      })
                    }
                  >
                    Retry verification
                  </Button>
                )}
                {file.state !== "deleting" && (
                  <Button
                    disabled={busy}
                    aria-label={`Delete ${file.filename}`}
                    onClick={() =>
                      void run(async () => {
                        await api(
                          `/files/${file.id}`,
                          "DELETE",
                          undefined,
                          session.csrf,
                        );
                        await refresh();
                      })
                    }
                  >
                    Delete
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
