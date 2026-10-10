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
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
  csrf?: string,
): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(csrf ? { "X-CSRF-Token": csrf } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json();
  if (!response.ok) {
    const message =
      typeof result.detail === "string"
        ? result.detail
        : Array.isArray(result.detail)
          ? result.detail
              .map(
                (e: { loc: string[]; msg: string }) =>
                  `${e.loc.slice(1).join(" · ")}: ${e.msg}`,
              )
              .join("; ")
          : "The service is unavailable.";
    throw new ApiError(response.status, message);
  }
  return result as T;
}
