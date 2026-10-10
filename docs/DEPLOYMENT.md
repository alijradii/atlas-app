# Deployment foundation

Production is blocked by `docs/release-status.json`. This reset retains Dockerfiles, private-service Compose networking, Caddy HTTPS routing and deployment scripts as infrastructure for the rebuild. It does not approve a release.

Before any deployment, review `docs/SECURITY.md`, resolve the recorded Next.js security blocker, rerun verification and audits, scan container images, validate private R2 and ClamAV, and rehearse backup/restore. New application release acceptance is required.

The production template reads a private `.env.production` based on `.env.production.example`. Replace every placeholder, set a unique database password, HTTPS public origin, private R2 credentials and immutable web/Python image digests. Only Caddy exposes public ports. The standalone frontend runs with Bun; application logic remains in Python.

`make prod-config` validates configuration. `make prod-up` and `make deploy RELEASE=...` enforce the release gate. Deployment expects an approved VPS and a verified pre-upgrade backup. First-account provisioning is an explicit local operator command inside the API service, after migrations; no setup endpoint is exposed.

Keep migration history and existing volumes. The foundation adds personal-file storage metadata without dropping previous school tables. Changing product scope is not permission to erase existing data.
