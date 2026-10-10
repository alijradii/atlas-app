import { api, type components } from "@school2036/api-client";

export type FileRecord = components["schemas"]["UploadView"];
type MediaType = components["schemas"]["UploadInput"]["media_type"];
const extensions: Record<string, MediaType> = {
  txt: "text/plain",
  md: "text/plain",
  srt: "text/plain",
  vtt: "text/plain",
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  mp4: "video/mp4",
  webm: "video/webm",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
};
export const uploadAccept = Object.keys(extensions)
  .map((ext) => `.${ext}`)
  .join(",");
export function fileType(file: File): MediaType {
  const type = extensions[file.name.split(".").at(-1)?.toLowerCase() ?? ""];
  if (!type)
    throw new Error(
      "Choose TXT, Markdown, PDF, DOCX, an image, MP4, WebM, MP3, WAV or M4A.",
    );
  const max = type.startsWith("video/") || type.startsWith("audio/") ? 50 : 10;
  if (!file.size || file.size > max * 1024 * 1024)
    throw new Error(`This file must be between 1 byte and ${max} MiB.`);
  return type;
}

/** Bytes go directly to staging; only the local API receives credentials. */
export async function transferFile(
  file: File,
  csrf: string,
  signal: AbortSignal,
  progress: (sent: number) => void,
  staged: (id: string) => void,
) {
  const type = fileType(file);
  const bytes = await file.arrayBuffer();
  signal.throwIfAborted();
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  signal.throwIfAborted();
  const checksum = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  const upload = await api<FileRecord>(
    "/uploads",
    "POST",
    { filename: file.name, media_type: type, size: file.size, checksum },
    csrf,
    signal,
  );
  staged(upload.id);
  if (!upload.url)
    throw new Error("No upload address was returned. Please retry.");
  const local = upload.url.startsWith("/api/v1/uploads/");
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    signal.addEventListener("abort", abort, { once: true });
    xhr.open("PUT", upload.url as string);
    xhr.withCredentials = local;
    xhr.setRequestHeader("Content-Type", type);
    if (local) xhr.setRequestHeader("X-CSRF-Token", csrf);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable)
        progress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error("Transfer failed. You can retry this file."));
    xhr.onerror = () =>
      reject(new Error("Connection lost. You can retry this file."));
    xhr.onabort = () =>
      reject(new DOMException("Upload cancelled", "AbortError"));
    xhr.onloadend = () => signal.removeEventListener("abort", abort);
    if (signal.aborted) {
      signal.removeEventListener("abort", abort);
      reject(new DOMException("Upload cancelled", "AbortError"));
      return;
    }
    xhr.send(bytes);
  });
  return api<FileRecord>(
    `/uploads/${upload.id}/complete`,
    "POST",
    undefined,
    csrf,
    signal,
  );
}
