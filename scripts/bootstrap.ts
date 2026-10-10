import { copyFile } from "node:fs/promises";

if (Bun.version !== "1.4.2")
  throw new Error("Install Bun 1.4.2, as pinned in .bun-version.");
for (const cmd of [
  ["uv", "--version"],
  ["docker", "compose", "version"],
]) {
  const child = Bun.spawn(cmd, { stdout: "inherit", stderr: "inherit" });
  if (await child.exited) process.exit(1);
}
if (!(await Bun.file(".env").exists())) await copyFile(".env.example", ".env");
for (const cmd of [
  [process.execPath, "install", "--frozen-lockfile"],
  ["uv", "sync", "--frozen"],
]) {
  const child = Bun.spawn(cmd, { stdout: "inherit", stderr: "inherit" });
  if (await child.exited) process.exit(1);
}
console.log("Ready. Run make dev to start the local services.");
