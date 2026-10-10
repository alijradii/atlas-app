import type { paths } from "./schema";

export type { paths } from "./schema";
export type Health =
  paths["/api/v1/health/live"]["get"]["responses"][200]["content"]["application/json"];
export async function getHealth(signal?: AbortSignal): Promise<Health> {
  const response = await fetch("/api/v1/health/live", {
    signal,
    cache: "no-store",
  });
  if (!response.ok)
    throw new Error("The school service is unavailable. Please try again.");
  return response.json();
}

export type { components } from "./schema";
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function errorDetail(result: unknown): string | undefined {
  if (!result || typeof result !== "object" || !("detail" in result))
    return undefined;
  const detail = result.detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (!Array.isArray(detail)) return undefined;
  const messages = detail.flatMap((entry: unknown) => {
    if (!entry || typeof entry !== "object" || !("msg" in entry)) return [];
    if (typeof entry.msg !== "string") return [];
    const location =
      "loc" in entry && Array.isArray(entry.loc)
        ? entry.loc
            .slice(1)
            .filter(
              (part) => typeof part === "string" || typeof part === "number",
            )
            .join(" · ")
        : "";
    return [location ? `${location}: ${entry.msg}` : entry.msg];
  });
  return messages.join("; ") || undefined;
}

export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
  csrf?: string,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    signal,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(csrf ? { "X-CSRF-Token": csrf } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const content = await response.text();
  let result: unknown;
  let readable = false;
  if (content) {
    try {
      result = JSON.parse(content);
      readable = true;
    } catch {
      // Proxies can return HTML or plain text. Preserve the HTTP status without
      // showing an internal proxy document or a JSON parser error to the user.
    }
  }
  if (!response.ok) {
    const message =
      errorDetail(result) ??
      (response.status === 401
        ? "Please sign in again."
        : "The service is unavailable. Please try again.");
    throw new ApiError(response.status, message);
  }
  if (response.status === 204 || response.status === 205) return undefined as T;
  if (!readable)
    throw new ApiError(
      response.status,
      "The service returned an unreadable response. Please try again.",
    );
  return result as T;
}
