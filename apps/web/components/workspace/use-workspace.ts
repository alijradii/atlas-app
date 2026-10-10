"use client";
import { ApiError, api } from "@school2036/api-client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Lesson, Session, Workspace } from "./types";

export function useWorkspace(section = "home") {
  const [session, setSession] = useState<Session | null>(null);
  const [data, setData] = useState<Workspace | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(true);
  const [signedOut, setSignedOut] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const account = useRef<string | null>(null);
  const reads = useRef<AbortController | null>(null);
  const writes = useRef<AbortController | null>(null);
  const refresh = useCallback(() => {
    setError("");
    setRevision((value) => value + 1);
  }, []);
  const clear = useCallback(() => {
    setData(null);
    setLessons([]);
  }, []);
  const expire = useCallback(() => {
    reads.current?.abort();
    writes.current?.abort();
    account.current = null;
    setSession(null);
    clear();
    setSignedOut(true);
    setBusy(false);
  }, [clear]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: revision reloads after writes; section reauthorizes current records on navigation.
  useEffect(() => {
    if (signedOut) return;
    let alive = true;
    let resumeTimer: ReturnType<typeof setTimeout> | undefined;
    const read = async () => {
      if (document.visibilityState === "hidden") return;
      reads.current?.abort();
      setChecking(true);
      const controller = new AbortController();
      reads.current = controller;
      const current = () => alive && !controller.signal.aborted;
      try {
        const next = await api<Session>(
          "/auth/me",
          "GET",
          undefined,
          undefined,
          controller.signal,
        );
        if (!current()) return;
        if (account.current !== next.account_id) {
          writes.current?.abort();
          clear();
          setBusy(false);
        }
        account.current = next.account_id;
        setSession(next);
        const workspace = await api<Workspace>(
          "/school/workspace",
          "GET",
          undefined,
          undefined,
          controller.signal,
        );
        if (!current()) return;
        if (workspace.account_id !== next.account_id) {
          clear();
          refresh();
          return;
        }
        const availableLessons = await api<Lesson[]>(
          "/study/lessons",
          "GET",
          undefined,
          undefined,
          controller.signal,
        );
        const confirmed = await api<Session>(
          "/auth/me",
          "GET",
          undefined,
          undefined,
          controller.signal,
        );
        if (!current()) return;
        if (confirmed.account_id !== next.account_id) {
          writes.current?.abort();
          clear();
          refresh();
          return;
        }
        setSession(confirmed);
        setData(workspace);
        setLessons(availableLessons);
      } catch (cause) {
        if (!current()) return;
        if (cause instanceof ApiError && cause.status === 401) expire();
        else {
          if (cause instanceof ApiError && cause.status === 403) clear();
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to open your workspace.",
          );
        }
      } finally {
        if (current()) {
          setLoading(false);
          setChecking(false);
        }
      }
    };
    // Desktop workspace switches emit both events. Coalesce the pair without
    // erasing already authorized content. A later focus still cancels stale reads.
    const resume = () => {
      clearTimeout(resumeTimer);
      if (document.visibilityState === "hidden") return;
      resumeTimer = setTimeout(() => void read(), 80);
    };
    void read();
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("focus", resume);
    return () => {
      alive = false;
      reads.current?.abort();
      clearTimeout(resumeTimer);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("focus", resume);
    };
  }, [revision, section, signedOut, clear, expire]);
  useEffect(
    () => () => {
      writes.current?.abort();
    },
    [],
  );
  async function mutate(path: string, body?: unknown, method = "POST") {
    if (!session || writes.current) return false;
    const owner = session.account_id;
    const controller = new AbortController();
    writes.current = controller;
    reads.current?.abort();
    setBusy(true);
    setError("");
    let saved = false;
    try {
      await api(path, method, body, session.csrf, controller.signal);
      saved = !controller.signal.aborted && account.current === owner;
      return saved;
    } catch (cause) {
      if (!controller.signal.aborted && account.current === owner) {
        if (cause instanceof ApiError && cause.status === 401) expire();
        else
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to save. Please try again.",
          );
      }
      return false;
    } finally {
      if (writes.current === controller) writes.current = null;
      if (account.current === owner) {
        setBusy(false);
        if (saved) refresh();
      }
    }
  }
  async function signOut() {
    if (await mutate("/auth/logout")) expire();
  }
  return {
    session,
    data,
    lessons,
    loading,
    checking,
    signedOut,
    busy,
    error,
    refresh,
    mutate,
    signOut,
  };
}
