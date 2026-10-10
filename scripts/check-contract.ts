const files = [
  "packages/api-client/openapi.json",
  "packages/api-client/src/schema.d.ts",
];
const before = await Promise.all(files.map((path) => Bun.file(path).text()));
const child = Bun.spawn([process.execPath, "run", "api:generate"], {
  stdout: "inherit",
  stderr: "inherit",
});
if (await child.exited) process.exit(1);
const after = await Promise.all(files.map((path) => Bun.file(path).text()));
if (before.some((value, index) => value !== after[index])) {
  console.error(
    "API contracts changed. Review and commit the regenerated files.",
  );
  process.exit(1);
}
