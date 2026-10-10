// Deployment runs on the configured VPS checkout over an operator-established SSH session.
// This script intentionally has no implicit target host or public-network provisioning.
const release = process.argv[2];
if (!release || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,80}$/.test(release))
  throw new Error("Pass RELEASE=<immutable release identifier>.");
const gate = Bun.spawn([process.execPath, "scripts/release-gate.ts"], {
  stdout: "inherit",
  stderr: "inherit",
});
if (await gate.exited) process.exit(1);
if (process.env.SCHOOL_DEPLOYMENT_TARGET !== "approved-vps")
  throw new Error(
    "Set SCHOOL_DEPLOYMENT_TARGET=approved-vps on the approved VPS only.",
  );
if (!process.env.SCHOOL_PREUPGRADE_BACKUP)
  throw new Error(
    "Set SCHOOL_PREUPGRADE_BACKUP to the verified encrypted pre-upgrade backup path.",
  );
if (!(await Bun.file(process.env.SCHOOL_PREUPGRADE_BACKUP).exists()))
  throw new Error("Pre-upgrade backup file is missing.");
const compose = [
  "docker",
  "compose",
  "--env-file",
  ".env.production",
  "-f",
  "infra/compose.prod.yaml",
];
const inspect = Bun.spawn([...compose, "config", "--format", "json"], {
  stdout: "pipe",
  stderr: "inherit",
});
const resolved = JSON.parse(await new Response(inspect.stdout).text()) as {
  services: Record<string, { image: string }>;
};
if (await inspect.exited) throw new Error("Invalid production configuration.");
for (const service of ["api", "web", "worker"]) {
  if (!/@sha256:[a-f0-9]{64}$/.test(resolved.services[service]?.image ?? ""))
    throw new Error(
      `${service} must use an immutable image digest from the approved release.`,
    );
}
for (const args of [
  ["config", "--quiet"],
  ["pull"],
  ["stop", "api", "worker", "beat"],
  ["run", "--rm", "migrate"],
  ["up", "-d", "--no-build", "--wait"],
]) {
  const child = Bun.spawn([...compose, ...args], {
    env: { ...process.env, RELEASE: release },
    stdout: "inherit",
    stderr: "inherit",
  });
  if (await child.exited)
    throw new Error(
      "Deployment stopped. Preserve maintenance mode and follow docs/OPERATIONS.md; do not blindly downgrade the database.",
    );
}
console.log(
  `Release ${release} started. Complete HTTPS, authentication, worker, and recovery smoke checks before reopening access.`,
);
