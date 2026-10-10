import { cp } from "node:fs/promises";
import { resolve } from "node:path";

// Exercise the same standalone artifact layout as Docker, against the disposable
// browser API. Never reuse the live app's build or its database/provider settings.
const root = resolve(import.meta.dir, "..");
const web = resolve(root, "apps/web");
const output = resolve(web, ".next-e2e");
const standalone = resolve(output, "standalone/apps/web");
const env = {
  ...process.env,
  SCHOOL_E2E: "1",
  API_INTERNAL_URL: "http://127.0.0.1:8100",
  NEXT_TELEMETRY_DISABLED: "1",
};
let child = Bun.spawn([process.execPath, "run", "build"], {
  cwd: web,
  env,
  stdout: "inherit",
  stderr: "inherit",
});
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => child.kill(signal));
const build = await child.exited;
if (build) process.exit(build);
await cp(resolve(output, "static"), resolve(standalone, ".next-e2e/static"), {
  recursive: true,
});
await cp(resolve(web, "public"), resolve(standalone, "public"), {
  recursive: true,
});
child = Bun.spawn([process.execPath, resolve(standalone, "server.js")], {
  cwd: standalone,
  env: { ...env, NODE_ENV: "production", HOSTNAME: "127.0.0.1", PORT: "3100" },
  stdout: "inherit",
  stderr: "inherit",
});
process.exit(await child.exited);
