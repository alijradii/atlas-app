"use client";

import { ApiError, api, type components } from "@school2036/api-client";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@school2036/ui";
import {
  ArrowUpRight,
  Check,
  FileText,
  Film,
  ImageIcon,
  LoaderCircle,
  Music2,
  Plus,
  UploadCloud,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  type FileRecord,
  fileType,
  transferFile,
  uploadAccept,
} from "./upload-transfer";
import "./file-library.css";

type Session = components["schemas"]["SessionView"];
type QueueItem = {
  id: string;
  file: File;
  progress: number;
  state: "waiting" | "sending" | "verifying" | "done" | "failed" | "cancelled";
  error?: string;
  cleanupId?: string;
};
const category = (file: FileRecord) =>
  file.media_type?.startsWith("video/") || file.media_type?.startsWith("audio/")
    ? "recordings"
    : file.media_type?.startsWith("image/")
      ? "images"
      : "documents";
const fileState: Record<string, string> = {
  pending: "Waiting for upload",
  queued: "Checking your file",
  quarantined: "Checking your file",
  accepted: "Ready",
  rejected: "Could not verify",
  deleting: "Removing",
  deleted: "Removed",
};
const size = (value: number) =>
  value >= 1024 * 1024
    ? `${(value / (1024 * 1024)).toFixed(1)} MiB`
    : `${Math.ceil(value / 1024)} KiB`;

export function FileLibrary({
  session,
  files,
  refresh,
  report,
  busy,
  run,
}: {
  session: Session;
  files: FileRecord[];
  refresh: () => Promise<void>;
  report: (error: unknown) => void;
  busy: boolean;
  run: (action: () => Promise<void>) => Promise<void>;
}) {
  const [filter, setFilter] = useState("all");
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState<FileRecord | null>(null);
  const [imported, setImported] = useState(false);
  const [deleting, setDeleting] = useState<FileRecord | null>(null);
  const [dialogError, setDialogError] = useState("");
  const current = useRef<{ id: string; controller: AbortController } | null>(
    null,
  );
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      current.current?.controller.abort();
    };
  }, []);
  const update = useCallback((id: string, patch: Partial<QueueItem>) => {
    if (alive.current)
      setQueue((items) =>
        items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      );
  }, []);
  const working = queue.some((item) =>
    ["waiting", "sending", "verifying"].includes(item.state),
  );
  useEffect(() => {
    if (current.current) return;
    const next = queue.find((item) => item.state === "waiting");
    if (!next) return;
    const controller = new AbortController();
    current.current = { id: next.id, controller };
    let staged: string | undefined;
    update(next.id, { state: "sending", progress: 0 });
    void transferFile(
      next.file,
      session.csrf,
      controller.signal,
      (progress) =>
        update(next.id, {
          progress,
          state: progress === 100 ? "verifying" : "sending",
        }),
      (id) => {
        staged = id;
      },
    )
      .then(() => {
        controller.signal.throwIfAborted();
        update(next.id, { state: "done", progress: 100 });
      })
      .catch(async (error) => {
        const cancelled = controller.signal.aborted;
        if (alive.current && error instanceof ApiError && error.status === 401)
          report(error);
        update(next.id, {
          state: cancelled ? "cancelled" : "failed",
          error: cancelled
            ? undefined
            : error instanceof Error
              ? error.message
              : "Upload failed.",
        });
        // Remove incomplete staging records so deliberate retries don't consume quota.
        if (staged)
          await api(
            `/files/${staged}`,
            "DELETE",
            undefined,
            session.csrf,
          ).catch(() => {
            update(next.id, {
              error:
                "The transfer stopped, but its incomplete file could not be removed. Retry will remove that entry before starting again.",
              cleanupId: staged,
            });
          });
      })
      .finally(() => {
        current.current = null;
        if (alive.current) {
          setQueue((items) => [...items]);
          void refresh().catch(report);
        }
      });
    // Queued items are processed sequentially; their own progress changes never restart a transfer.
  }, [queue, session.csrf, refresh, report, update]);

  function addFiles(values: FileList | File[]) {
    if (busy) return;
    try {
      const added = Array.from(values);
      if (
        added.length +
          queue.filter((item) =>
            ["waiting", "sending", "verifying"].includes(item.state),
          ).length >
        10
      )
        throw new Error("Add up to 10 files at a time.");
      for (const file of added) fileType(file);
      setQueue((items) => [
        ...items,
        ...added.map((file) => ({
          id: crypto.randomUUID(),
          file,
          progress: 0,
          state: "waiting" as const,
        })),
      ]);
    } catch (error) {
      report(error);
    }
  }
  return (
    <>
      <section
        className="pearl-upload glass-panel"
        aria-labelledby="upload-heading"
      >
        <div>
          <p className="eyebrow">Bring your materials</p>
          <h2 id="upload-heading">A place for every lesson.</h2>
          <p>
            Keep documents and recordings together. Choose what you want to
            study when you’re ready.
          </p>
        </div>
        <label
          className="pearl-dropzone"
          data-dragging={dragging}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            addFiles(event.dataTransfer.files);
          }}
        >
          <UploadCloud aria-hidden="true" />
          <strong>Drop your files here</strong>
          <span>or choose from your device</span>
          <input
            aria-label="Choose a file"
            type="file"
            multiple
            accept={uploadAccept}
            disabled={busy}
            onChange={(event) => {
              if (event.target.files) addFiles(event.target.files);
              event.target.value = "";
            }}
          />
          <small>
            Documents & images · 10 MiB
            <br />
            Audio & video · 50 MiB
          </small>
        </label>
      </section>
      {queue.length > 0 && (
        <section
          className="pearl-transfers glass-panel"
          aria-label="Upload progress"
          aria-live="polite"
        >
          <header>
            <h2>{working ? "Bringing your files in…" : "Transfers"}</h2>
            {!working && (
              <Button variant="ghost" size="sm" onClick={() => setQueue([])}>
                Clear finished
              </Button>
            )}
          </header>
          {queue.map((item) => (
            <div className="pearl-transfer" key={item.id}>
              <FileText aria-hidden="true" />
              <div>
                <strong>{item.file.name}</strong>
                <span>
                  {item.error ||
                    {
                      waiting: "Queued",
                      sending: `Uploading · ${item.progress}%`,
                      verifying: "Upload complete · verifying",
                      done: "Uploaded · verification continues in your library",
                      cancelled: "Cancelled",
                      failed: "Failed",
                    }[item.state]}
                </span>
                {["sending", "verifying"].includes(item.state) && (
                  <progress
                    aria-label={`Uploading ${item.file.name}`}
                    max={100}
                    value={item.progress}
                  />
                )}
              </div>
              {["waiting", "sending", "verifying"].includes(item.state) ? (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Cancel upload ${item.file.name}`}
                  onClick={() => {
                    if (current.current?.id === item.id)
                      current.current.controller.abort();
                    else update(item.id, { state: "cancelled" });
                  }}
                >
                  <X />
                </Button>
              ) : item.state === "failed" || item.state === "cancelled" ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy || current.current?.id === item.id}
                  onClick={() =>
                    void run(async () => {
                      if (item.cleanupId)
                        await api(
                          `/files/${item.cleanupId}`,
                          "DELETE",
                          undefined,
                          session.csrf,
                        );
                      update(item.id, {
                        state: "waiting",
                        error: undefined,
                        cleanupId: undefined,
                        progress: 0,
                      });
                    })
                  }
                >
                  Retry
                </Button>
              ) : (
                <Check aria-label="Uploaded" />
              )}
            </div>
          ))}
        </section>
      )}
      <section className="pearl-library" aria-labelledby="library-heading">
        <header>
          <div>
            <p className="eyebrow">Only shared when you choose</p>
            <h2 id="library-heading">Your library</h2>
          </div>
          <span>
            {files.length} {files.length === 1 ? "file" : "files"}
          </span>
        </header>
        <fieldset className="pearl-file-filters" aria-label="Filter files">
          {["all", "documents", "recordings", "images"].map((value) => (
            <Button
              key={value}
              variant={filter === value ? "default" : "ghost"}
              size="sm"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {value === "all"
                ? "All files"
                : value[0].toUpperCase() + value.slice(1)}
            </Button>
          ))}
        </fieldset>
        <ul aria-label="Your files" className="pearl-file-list">
          {files
            .filter((file) => filter === "all" || category(file) === filter)
            .map((file) => {
              const Icon = file.media_type?.startsWith("video/")
                ? Film
                : file.media_type?.startsWith("audio/")
                  ? Music2
                  : category(file) === "images"
                    ? ImageIcon
                    : FileText;
              return (
                <li className="glass-panel pearl-file" key={file.id}>
                  <Icon className="pearl-file-icon" aria-hidden="true" />
                  <div className="pearl-file-description">
                    <strong>{file.filename}</strong>
                    <span>
                      {size(file.size)} · {fileState[file.state] || file.state}
                    </span>
                    {file.error && (
                      <p className="text-destructive">{file.error}</p>
                    )}
                  </div>
                  <div className="pearl-file-actions">
                    {file.state === "accepted" && (
                      <>
                        <Button asChild variant="ghost" size="sm">
                          <a
                            href={`/api/v1/files/${file.id}/download`}
                            aria-label={`Download ${file.filename}`}
                          >
                            Download
                          </a>
                        </Button>
                        {category(file) !== "images" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setImporting(file);
                              setImported(false);
                              setDialogError("");
                            }}
                          >
                            <Plus />
                            Use for study
                          </Button>
                        )}
                      </>
                    )}
                    {["queued", "quarantined"].includes(file.state) && (
                      <Button
                        variant="ghost"
                        size="sm"
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
                        <LoaderCircle />
                        Retry verification
                      </Button>
                    )}
                    {file.state !== "deleting" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        aria-label={`Delete ${file.filename}`}
                        onClick={() => {
                          setDeleting(file);
                          setDialogError("");
                        }}
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
        </ul>
        {!files.some(
          (file) => filter === "all" || category(file) === filter,
        ) && (
          <div className="pearl-file-empty">
            <FileText aria-hidden="true" />
            <h3>
              {files.length
                ? "No files in this category"
                : "Your library starts here"}
            </h3>
            <p>Add a document or recording using the area above.</p>
          </div>
        )}
      </section>
      <Dialog
        open={!!importing}
        onOpenChange={(open) => {
          if (!open && !busy) setImporting(null);
        }}
      >
        <DialogContent className="pearl-import-dialog">
          <DialogHeader>
            <DialogTitle>
              {imported
                ? "Your material is being prepared"
                : "Use this material for study"}
            </DialogTitle>
            <DialogDescription>
              {imported
                ? "Open Study to review the extracted text before it becomes a lesson."
                : `We’ll prepare ${importing?.filename ?? "your file"} for you to review. The material stays private until you share it.`}
            </DialogDescription>
          </DialogHeader>
          {dialogError && (
            <p role="alert" className="text-sm text-destructive">
              {dialogError}
            </p>
          )}
          {imported ? (
            <Button asChild>
              <Link href="/study">
                Open study workspace <ArrowUpRight />
              </Link>
            </Button>
          ) : (
            <form
              className="grid gap-5"
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                setDialogError("");
                void run(async () => {
                  try {
                    await api(
                      "/study/imports",
                      "POST",
                      {
                        file_id: importing?.id,
                        title: data.get("title"),
                        subject: data.get("subject"),
                      },
                      session.csrf,
                    );
                    if (alive.current) setImported(true);
                  } catch (cause) {
                    if (alive.current)
                      setDialogError(
                        cause instanceof Error
                          ? cause.message
                          : "This material could not be prepared. Try again.",
                      );
                    throw cause;
                  }
                });
              }}
            >
              <Label className="grid gap-2">
                Lesson title
                <Input
                  name="title"
                  required
                  maxLength={160}
                  defaultValue={importing?.filename
                    .replace(/\.[^.]+$/, "")
                    .slice(0, 160)}
                />
              </Label>
              <Label className="grid gap-2">
                Subject (optional)
                <Input name="subject" maxLength={80} />
              </Label>
              <p className="text-sm text-muted-foreground">
                {importing && category(importing) === "recordings"
                  ? "Recordings up to 20 minutes are transcribed using Gemini. Only the audio is sent for transcription. You can correct the result before adding it to your study sources."
                  : "We extract readable text from documents. Scanned PDFs need a text transcript; images and diagrams are not interpreted."}
              </p>
              <Button disabled={busy} type="submit">
                {busy ? "Preparing…" : "Prepare material"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open && !busy) setDeleting(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {deleting?.filename}?</DialogTitle>
            <DialogDescription>
              This removes access to the original file. Any reviewed study
              transcript is a separate lesson; remove it in Study if you want to
              remove that too.
            </DialogDescription>
          </DialogHeader>
          {dialogError && (
            <p role="alert" className="text-sm text-destructive">
              {dialogError}
            </p>
          )}
          <Button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                setDialogError("");
                try {
                  await api(
                    `/files/${deleting?.id}`,
                    "DELETE",
                    undefined,
                    session.csrf,
                  );
                  if (alive.current) setDeleting(null);
                  await refresh();
                } catch (cause) {
                  if (alive.current)
                    setDialogError(
                      cause instanceof Error
                        ? cause.message
                        : "The file could not be deleted. Try again.",
                    );
                  throw cause;
                }
              })
            }
          >
            Delete file
          </Button>
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => setDeleting(null)}
          >
            Keep file
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
