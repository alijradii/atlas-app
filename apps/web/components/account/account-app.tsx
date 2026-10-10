"use client";

import { ApiError, api, type components } from "@school2036/api-client";
import { Button, Input, Label } from "@school2036/ui";
import { KeyRound, Monitor, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ConnectedShell } from "../connected-shell";
import "./account.css";

type Session = components["schemas"]["SessionView"];
type AccountSession = components["schemas"]["AccountSessionView"];
type RevokeResult = components["schemas"]["SessionRevokeView"];

export default function AccountApp() {
  const router = useRouter();
  const generation = useRef(0);
  const mutating = useRef(false);
  const pending = useRef<AbortController | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [sessions, setSessions] = useState<AccountSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const accountId = useRef<string | null>(null);
  const clearPasswords = useCallback(() => {
    setCurrent("");
    setPassword("");
    setConfirmation("");
  }, []);
  const report = useCallback(
    (cause: unknown) => {
      if (cause instanceof ApiError && cause.status === 401) {
        accountId.current = null;
        setSession(null);
        setSessions([]);
        clearPasswords();
        router.replace("/login?next=account");
      }
      if (cause instanceof ApiError && cause.status === 403) {
        setSessions([]);
        clearPasswords();
      }
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not update your account. Try again.",
      );
    },
    [router, clearPasswords],
  );
  const refresh = useCallback(async () => {
    const version = ++generation.current;
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    if (!accountId.current) setLoading(true);
    setError("");
    try {
      const identity = await api<Session>(
        "/auth/me",
        "GET",
        undefined,
        undefined,
        controller.signal,
      );
      if (version !== generation.current || controller.signal.aborted) return;
      if (accountId.current !== identity.account_id) {
        clearPasswords();
        setSessions([]);
        setNotice("");
      }
      accountId.current = identity.account_id;
      setSession(identity);
      const list = await api<AccountSession[]>(
        "/account/sessions",
        "GET",
        undefined,
        undefined,
        controller.signal,
      );
      if (version !== generation.current) return;
      setSessions(list);
    } catch (cause) {
      if (version === generation.current && !controller.signal.aborted)
        report(cause);
    } finally {
      if (version === generation.current) setLoading(false);
    }
  }, [report, clearPasswords]);
  useEffect(() => {
    void refresh();
    let resumeTimer: ReturnType<typeof setTimeout> | undefined;
    const resume = () => {
      clearTimeout(resumeTimer);
      if (document.visibilityState === "visible" && !mutating.current)
        resumeTimer = setTimeout(() => void refresh(), 80);
    };
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("focus", resume);
    return () => {
      ++generation.current;
      clearTimeout(resumeTimer);
      pending.current?.abort();
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("focus", resume);
    };
  }, [refresh]);

  const passwordLength = [...password].length;
  const mismatch = confirmation.length > 0 && password !== confirmation;
  const canChange =
    current.length > 0 &&
    passwordLength >= 15 &&
    passwordLength <= 128 &&
    password === confirmation;
  const others = sessions.filter((value) => !value.current).length;

  async function changePassword() {
    if (!session || !canChange || mutating.current) return;
    mutating.current = true;
    pending.current?.abort();
    const version = ++generation.current;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const fresh = await api<Session>(
        "/account/password",
        "POST",
        { current_password: current, new_password: password },
        session.csrf,
      );
      if (version !== generation.current) return;
      setSession(fresh);
      clearPasswords();
      setNotice(
        "Password updated. Other sessions are signed out, and this session has been renewed.",
      );
      await refresh();
    } catch (cause) {
      if (version === generation.current) report(cause);
    } finally {
      mutating.current = false;
      setBusy(false);
    }
  }
  async function revokeOthers() {
    if (!session || mutating.current) return;
    mutating.current = true;
    pending.current?.abort();
    const version = ++generation.current;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api<RevokeResult>(
        "/account/sessions/revoke-others",
        "POST",
        undefined,
        session.csrf,
      );
      if (version !== generation.current) return;
      setNotice("Other sessions are signed out. You are still signed in here.");
      await refresh();
    } catch (cause) {
      if (version === generation.current) report(cause);
    } finally {
      mutating.current = false;
      setBusy(false);
    }
  }
  const content = (
    <div className="account-main w-full">
      <div className="account-heading">
        <p className="eyebrow">Security &amp; access</p>
        <h1>Your account</h1>
        <p>Manage your password and the sessions that can access your work.</p>
      </div>
      {error && (
        <p role="alert" className="account-error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="account-notice">
          <ShieldCheck aria-hidden="true" />
          {notice}
        </p>
      )}
      {loading ? (
        <p role="status">Opening account settings…</p>
      ) : !session ? (
        <Button variant="outline" onClick={() => void refresh()}>
          Try again
        </Button>
      ) : (
        <>
          <p className="account-identity">
            Signed in as <strong>{session.name}</strong> · {session.login}
          </p>
          <section
            className="account-panel"
            aria-labelledby="password-heading"
            data-guide-anchor="account.security"
          >
            <div className="account-section-heading">
              <KeyRound aria-hidden="true" />
              <div>
                <h2 id="password-heading">Change password</h2>
                <p>
                  Use 15–128 characters. Updating your password signs out all
                  other sessions.
                </p>
              </div>
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void changePassword();
              }}
            >
              <div className="account-field">
                <Label htmlFor="account-current">Current password</Label>
                <Input
                  id="account-current"
                  type="password"
                  autoComplete="current-password"
                  value={current}
                  onChange={(event) => setCurrent(event.target.value)}
                  required
                  disabled={busy}
                />
              </div>
              <div className="account-field">
                <Label htmlFor="account-new">New password</Label>
                <Input
                  id="account-new"
                  type="password"
                  autoComplete="new-password"
                  aria-describedby="account-password-rule"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  disabled={busy}
                />
                <p id="account-password-rule">
                  15–128 characters, including spaces if you like.
                </p>
              </div>
              <div className="account-field">
                <Label htmlFor="account-confirm">Confirm new password</Label>
                <Input
                  id="account-confirm"
                  type="password"
                  autoComplete="new-password"
                  aria-invalid={mismatch}
                  aria-describedby={mismatch ? "account-mismatch" : undefined}
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  required
                  disabled={busy}
                />
                {mismatch && (
                  <p id="account-mismatch" className="text-destructive">
                    The new passwords do not match.
                  </p>
                )}
              </div>
              <Button type="submit" disabled={!canChange || busy}>
                {busy ? "Updating…" : "Update password"}
              </Button>
            </form>
          </section>
          <section className="account-panel" aria-labelledby="sessions-heading">
            <div className="account-section-heading">
              <Monitor aria-hidden="true" />
              <div>
                <h2 id="sessions-heading">Signed-in sessions</h2>
                <p>
                  {others === 0
                    ? "You are only signed in here."
                    : `${others} other ${others === 1 ? "session has" : "sessions have"} access to your account.`}{" "}
                  Sessions expire after 30 minutes of inactivity or eight hours.
                </p>
              </div>
            </div>
            <ul className="account-sessions">
              {sessions.map((value) => (
                <li key={`${value.created}-${value.current}`}>
                  <div>
                    <strong>
                      {value.current ? "This session" : "Other session"}
                    </strong>
                    <span>
                      Started {new Date(value.created * 1000).toLocaleString()}
                    </span>
                  </div>
                  <span>
                    Last active{" "}
                    {new Date(value.last_seen * 1000).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
            <Button
              variant="outline"
              disabled={busy || others === 0}
              onClick={() => void revokeOthers()}
            >
              Sign out other sessions
            </Button>
          </section>
          <p className="account-recovery">
            Forgot your current password? Ask your Atlas operator to reset it.
            Recovery also signs out existing sessions.
          </p>
        </>
      )}
    </div>
  );
  return session ? (
    <ConnectedShell session={session} section="account">
      {content}
    </ConnectedShell>
  ) : (
    <main id="main-content">{content}</main>
  );
}
