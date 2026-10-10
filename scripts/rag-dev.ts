import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const service = resolve(root, "services/rag-anything");
const environment = resolve(root, ".tools/rag-venv");
const python =
  process.env.SCHOOL_RAG_PYTHON || resolve(environment, "bin/python");
process.chdir(root);
if (Bun.version !== "1.4.2")
  throw new Error("Use Bun 1.4.2 (see .bun-version).");

async function run(command: string[], cwd = root) {
  const child = Bun.spawn(command, {
    cwd,
    env: { ...process.env, UV_CACHE_DIR: resolve(root, ".cache/uv-rag") },
    stdout: "inherit",
    stderr: "inherit",
  });
  if (await child.exited) throw new Error("RAG runtime setup failed.");
}

if (process.argv.includes("--install")) {
  if (process.env.SCHOOL_RAG_PYTHON)
    throw new Error(
      "Unset SCHOOL_RAG_PYTHON before installing the isolated RAG environment.",
    );
  await mkdir(resolve(root, ".tools"), { recursive: true });
  if (!(await Bun.file(python).exists()))
    await run(["uv", "venv", "--python", "3.12", environment]);
  await run([
    "uv",
    "pip",
    "sync",
    "--python",
    python,
    "--require-hashes",
    "--extra-index-url",
    "https://download.pytorch.org/whl/cpu",
    resolve(service, "requirements.lock"),
  ]);
  console.log(
    "RAG runtime installed. Run bun run scripts/rag-dev.ts to start it.",
  );
  process.exit(0);
}

if (!(await Bun.file(python).exists()))
  throw new Error(
    "Install the separate RAG runtime: bun run scripts/rag-dev.ts --install",
  );
const key = process.env.SCHOOL_RAG_API_KEY || "";
const gemini = process.env.SCHOOL_GEMINI_API_KEY || "";
if (!/^[\x20-\x7e]{32,}$/.test(key) || !gemini)
  throw new Error(
    "Set SCHOOL_RAG_API_KEY (32+ ASCII characters) and SCHOOL_GEMINI_API_KEY in .env.",
  );
const ceiling = Number(process.env.SCHOOL_RAG_SPEND_LIMIT_USD || "1");
if (!Number.isFinite(ceiling) || ceiling <= 0)
  throw new Error(
    "SCHOOL_RAG_SPEND_LIMIT_USD must be a finite positive number.",
  );
const version = Bun.spawnSync([
  python,
  "-c",
  "import sys; sys.exit(0 if sys.version_info[:2] == (3, 12) else 1)",
]);
if (version.exitCode !== 0)
  throw new Error("RAG requires its own Python 3.12 environment.");
const data = resolve(root, ".data/rag");
await mkdir(data, { recursive: true, mode: 0o700 });
const child = Bun.spawn(
  [python, "-m", "rag_service", "--host", "127.0.0.1", "--port", "8081"],
  {
    cwd: service,
    env: {
      ...process.env,
      PYTHONPATH: service,
      PYTHONDONTWRITEBYTECODE: "1",
      RAG_DATA_DIR: data,
      RAG_API_KEY: key,
      GEMINI_API_KEY: gemini,
      RAG_CHUNK_MODE: "structural",
      RAG_SPEND_LIMIT_USD: String(ceiling),
      RAG_RETAIN_TRACES: "0",
      MINERU_TOOLS_CONFIG_JSON: resolve(data, "mineru.json"),
    },
    stdout: "inherit",
    stderr: "inherit",
  },
);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => child.kill(signal));
process.exit(await child.exited);
