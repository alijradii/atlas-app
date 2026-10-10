import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
process.chdir(root);
if (Bun.version !== "1.4.2")
  throw new Error("Use Bun 1.4.2 (see .bun-version).");
if (!(await Bun.file(".env").exists()))
  throw new Error("Run make bootstrap first.");
if (process.env.SCHOOL_ENVIRONMENT !== "development")
  throw new Error("make dev only accepts a development environment.");
for (const name of ["SCHOOL_DATABASE_URL", "SCHOOL_REDIS_URL"]) {
  const host = new URL(process.env[name] ?? "").hostname;
  if (!["localhost", "127.0.0.1"].includes(host))
    throw new Error(`${name} must point to local development infrastructure.`);
}
const full = process.argv.includes("--full");
const infra = Bun.spawn(
  [
    "docker",
    "compose",
    "-f",
    "infra/compose.dev.yaml",
    ...(full ? ["--profile", "full"] : []),
    "up",
    "-d",
    "--wait",
  ],
  { stdout: "inherit", stderr: "inherit" },
);
if (await infra.exited) process.exit(1);
const migration = Bun.spawn(
  ["uv", "run", "--frozen", "alembic", "upgrade", "head"],
  { stdout: "inherit", stderr: "inherit" },
);
if (await migration.exited) process.exit(1);
await mkdir(".data", { recursive: true });
const beat = [
  "uv",
  "run",
  "--frozen",
  "celery",
  "-A",
  "school_worker.main:app",
  "beat",
  "--schedule",
  ".data/celerybeat",
];
const commands = [
  beat,
  [process.execPath, "run", "--cwd", "apps/web", "dev"],
  [
    "uv",
    "run",
    "--frozen",
    "uvicorn",
    "school_api.main:app",
    "--reload",
    "--reload-dir",
    "apps/api/src",
    "--reload-dir",
    "packages/backend/src",
    "--host",
    "127.0.0.1",
    "--port",
    "8000",
  ],
  [
    "uv",
    "run",
    "--frozen",
    "celery",
    "-A",
    "school_worker.main:app",
    "worker",
    "--loglevel=INFO",
    "--concurrency=2",
    "-Q",
    "general",
  ],
];
if (process.env.SCHOOL_RAG_API_KEY && process.env.SCHOOL_GEMINI_API_KEY)
  commands.push([process.execPath, "run", "scripts/rag-dev.ts"]);
if (full)
  commands.push([
    "uv",
    "run",
    "--frozen",
    "uvicorn",
    "school_ai.main:app",
    "--reload",
    "--reload-dir",
    "apps/ai/src",
    "--host",
    "127.0.0.1",
    "--port",
    "8001",
  ]);
if (full)
  console.log(
    "Full infrastructure: internal AI placeholder on localhost:8001, scanner on localhost:3310 and mail capture on localhost:8025.",
  );
const children = commands.map((cmd) =>
  Bun.spawn(cmd, { stdout: "inherit", stderr: "inherit" }),
);
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
const firstExit = await Promise.race(
  children.map(async (child) => await child.exited),
);
stop();
const timeout = setTimeout(() => {
  for (const child of children) child.kill("SIGKILL");
}, 5000);
await Promise.all(children.map((child) => child.exited));
clearTimeout(timeout);
process.exit(firstExit);
