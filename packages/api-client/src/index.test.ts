import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { ApiError, api } from "./index";

let fetchMock: ReturnType<typeof spyOn<typeof globalThis, "fetch">> | undefined;
afterEach(() => fetchMock?.mockRestore());

function respond(body: string | null, status = 200) {
  fetchMock = spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(body, { status }),
  );
}

async function failure() {
  try {
    await api("/files");
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    return error as ApiError;
  }
  throw new Error("Expected the request to fail");
}

describe("API response boundaries", () => {
  test("returns JSON and sends cookies, CSRF, body and cancellation signal", async () => {
    respond('{"id":"uploaded"}');
    const controller = new AbortController();
    expect(
      await api<{ id: string }>(
        "/uploads",
        "POST",
        { filename: "notes.txt" },
        "csrf",
        controller.signal,
      ),
    ).toEqual({ id: "uploaded" });
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/uploads", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", "X-CSRF-Token": "csrf" },
      body: '{"filename":"notes.txt"}',
    });
  });

  test.each([204, 205])("accepts an empty %s response", async (status) => {
    respond(null, status);
    expect(await api("/resource", "DELETE")).toBeUndefined();
  });

  test("preserves API error messages", async () => {
    respond('{"detail":"Media quota reached"}', 413);
    expect(await failure()).toMatchObject({
      status: 413,
      message: "Media quota reached",
    });
  });

  test("formats validation locations including array indices", async () => {
    respond(
      JSON.stringify({
        detail: [
          { loc: ["body", "files", 0, "name"], msg: "Required" },
          { msg: "Another invalid field" },
          null,
          { loc: true, msg: 123 },
        ],
      }),
      422,
    );
    expect(await failure()).toMatchObject({
      status: 422,
      message: "files · 0 · name: Required; Another invalid field",
    });
  });

  test.each([
    "<html>private proxy details</html>",
    "",
    "null",
    '{"detail":[null]}',
  ])("keeps HTTP status for unreadable error body %s", async (body) => {
    respond(body, 502);
    expect(await failure()).toMatchObject({
      status: 502,
      message: "The service is unavailable. Please try again.",
    });
  });

  test("non-JSON 401 remains recognizable as expired authentication", async () => {
    respond("Unauthorized", 401);
    expect(await failure()).toMatchObject({
      status: 401,
      message: "Please sign in again.",
    });
  });

  test("rejects malformed successful data instead of returning a fake result", async () => {
    respond("<html>Sign in at the gateway</html>");
    expect(await failure()).toMatchObject({
      status: 200,
      message: "The service returned an unreadable response. Please try again.",
    });
  });
});
