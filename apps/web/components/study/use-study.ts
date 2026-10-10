"use client";

import { ApiError, api } from "@school2036/api-client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  activeRun,
  type Conversation,
  type Lesson,
  type Session,
  type StudyStatus,
  type Thread,
} from "./types";

/** Private data stays in memory; every read is authenticated and stale reads are discarded. */
export function useStudy() {
  const [session, setSession] = useState<Session | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [status, setStatus] = useState<StudyStatus | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [thread, setThread] = useState<Thread | null>(null);
  const [loading, setLoading] = useState(true);
  const [signedOut, setSignedOut] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const account = useRef<string | null>(null);
  const readAbort = useRef<AbortController | null>(null);
  const writeAbort = useRef<AbortController | null>(null);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  const clearPrivate = useCallback(() => {
    setLessons([]);
    setConversations([]);
    setThread(null);
    setSelectedId(null);
    setStatus(null);
  }, []);
  const expire = useCallback(() => {
    readAbort.current?.abort();
    writeAbort.current?.abort();
    account.current = null;
    setSession(null);
    clearPrivate();
    setSignedOut(true);
    setBusy(false);
  }, [clearPrivate]);
  const selectThread = useCallback((id: string | null) => {
    readAbort.current?.abort();
    setThread(null);
    setSelectedId(id);
    setError("");
    setRevision((value) => value + 1);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: revision deliberately restarts reads after a mutation or explicit retry.
  useEffect(() => {
    if (signedOut) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const pause = () => {
      clearTimeout(timer);
      readAbort.current?.abort();
    };
    const tick = async () => {
      pause();
      if (!alive || document.visibilityState === "hidden") return;
      const controller = new AbortController();
      readAbort.current = controller;
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
        if (account.current && next.account_id !== account.current) {
          writeAbort.current?.abort();
          clearPrivate();
          setBusy(false);
          setError("");
          account.current = next.account_id;
          setSession(next);
          refresh();
          return;
        }
        account.current = next.account_id;
        setSession(next);
        const [nextLessons, nextConversations, nextStatus, nextThread] =
          await Promise.all([
            api<Lesson[]>(
              "/study/lessons",
              "GET",
              undefined,
              undefined,
              controller.signal,
            ),
            api<Conversation[]>(
              "/study/conversations",
              "GET",
              undefined,
              undefined,
              controller.signal,
            ),
            api<StudyStatus>(
              "/study/status",
              "GET",
              undefined,
              undefined,
              controller.signal,
            ),
            selectedId
              ? api<Thread>(
                  `/study/conversations/${selectedId}`,
                  "GET",
                  undefined,
                  undefined,
                  controller.signal,
                )
              : Promise.resolve(null),
          ]);
        if (!current()) return;
        setLessons(nextLessons);
        setConversations(nextConversations);
        setStatus(nextStatus);
        setThread(nextThread);
        if (
          nextLessons.some(
            (lesson) =>
              lesson.state === "queued" ||
              lesson.state === "extracting" ||
              lesson.state === "indexing",
          ) ||
          activeRun(nextThread?.run)
        )
          timer = setTimeout(() => void tick(), 1500);
      } catch (cause) {
        if (!current()) return;
        if (cause instanceof ApiError && cause.status === 401) expire();
        else {
          if (cause instanceof ApiError && [403, 404].includes(cause.status)) {
            setThread(null);
            setLessons([]);
            setSelectedId(null);
          }
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load your workspace. Try again.",
          );
        }
      } finally {
        if (current()) setLoading(false);
      }
    };
    const visible = () => {
      if (document.visibilityState === "hidden") pause();
      else void tick();
    };
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("focus", visible);
    void tick();
    return () => {
      alive = false;
      pause();
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("focus", visible);
    };
  }, [selectedId, revision, signedOut, clearPrivate, expire, refresh]);

  useEffect(
    () => () => {
      writeAbort.current?.abort();
    },
    [],
  );

  async function mutate<T>(
    path: string,
    method = "POST",
    body?: unknown,
  ): Promise<{ ok: boolean; value?: T }> {
    if (!session || writeAbort.current) return { ok: false };
    const owner = session.account_id;
    const controller = new AbortController();
    writeAbort.current = controller;
    readAbort.current?.abort();
    setBusy(true);
    setError("");
    try {
      const value = await api<T>(
        path,
        method,
        body,
        session.csrf,
        controller.signal,
      );
      if (controller.signal.aborted || account.current !== owner)
        return { ok: false };
      return { ok: true, value };
    } catch (cause) {
      if (!controller.signal.aborted && account.current === owner) {
        if (cause instanceof ApiError && cause.status === 401) expire();
        else
          setError(
            cause instanceof Error
              ? cause.message
              : "The action failed. Try again.",
          );
      }
      return { ok: false };
    } finally {
      if (writeAbort.current === controller) writeAbort.current = null;
      if (account.current === owner) {
        setBusy(false);
        refresh();
      }
    }
  }
  async function signOut() {
    const result = await mutate("/auth/logout");
    if (result.ok) expire();
  }
  return {
    session,
    lessons,
    conversations,
    status,
    selectedId,
    thread,
    loading,
    signedOut,
    busy,
    error,
    setError,
    refresh,
    selectThread,
    mutate,
    signOut,
    expire,
  };
}
