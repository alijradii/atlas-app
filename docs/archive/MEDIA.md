> Historical reference from before the October 10, 2026 reset. This does not describe the current application. See the root README.

# Protected learning media

The API accepts text, PDF, PNG and JPEG, up to 10 MB per object and 100 MB reserved/accepted bytes per account by default. At most ten uploads per account may be pending, queued or quarantined. Storage keys are opaque identifiers. Original file names are used only in authenticated attachment delivery.

## Local development

```sh
docker compose -f infra/compose.dev.yaml --profile media up -d --wait scanner
# Set SCHOOL_SCANNER_HOST=127.0.0.1 in your private development environment.
make dev-full
SCHOOL_TEST_SCANNER=1 make check
```

The scanner image is ClamAV 1.5.4 pinned to registry digest `sha256:ebec5bc138401b36ae987caa1a3fa3c3b2a21ed3d51f0bfa5852825e663e67b0`. Its signature volume persists updates. The development scanner binds only to `127.0.0.1:3310`; production exposes no scanner port. Allocate capacity for its 4 GiB memory limit. See the official [container instructions](https://docs.clamav.net/manual/Installing/Docker.html) and [INSTREAM protocol](https://docs.clamav.net/manual/Usage/ClamdProtocol.html).

Without a scanner, local development permits strictly decoded plain text only. Binary uploads stay quarantined. Production requires scanner configuration and never uses that text-only shortcut. A timeout, unknown scanner response or unavailable storage never accepts a file. Scanned/R2 uploads use the durable worker so unavailable media does not hold the API's installation lock. Start the worker/beat with `make dev-full`; quick local text completion can run without it.

## R2 contract and configuration

Use a private bucket with public URLs disabled, restricted bucket credentials and exact CORS origins. Example development CORS (replace the origin deliberately):

```json
[{"AllowedOrigins":["http://localhost:3000"],"AllowedMethods":["PUT"],"AllowedHeaders":["content-type"],"MaxAgeSeconds":300}]
```

The authorized upload endpoint signs only a unique staging PUT for five minutes with its content type. The browser sends that content type. Completion queues bounded capture; workers read at most the declared size plus one byte, verify size/checksum/type, scan a fixed server-only quarantine object, and promote those exact bytes under an immutable final key. Reusing the staging URL cannot change approved bytes. Cleanup repeats after expiry, including a staging object recreated through an unexpired URL. See [Cloudflare's boto3 examples](https://developers.cloudflare.com/r2/examples/aws/boto3/) and [CORS configuration](https://developers.cloudflare.com/r2/buckets/cors/).

Downloads use the authenticated API proxy, not a bearer GET URL in the product. The API rechecks current course/guardian-independent learning authorization, publication state and submission ownership on every read. Attachments use `application/octet-stream`, `nosniff` and a sandbox policy. Private notes and submission attachments never become guardian course resources. Storage outage messages are generic and retryable.

Unused file deletion revokes access immediately and queues retryable object cleanup. Historical references block ad hoc deletion. No extraction, thumbnails or embeddings are generated, so no derived objects are silently left outside these permissions.

## Adapter acceptance

```sh
# Use only a dedicated private bucket whose name ends in -integration.
# Supply SCHOOL_R2_* credentials privately and configure its development CORS.
SCHOOL_TEST_R2=1 uv run --frozen pytest tests/test_media_integration.py -q
```

The opt-in R2 test covers CORS, signed staging writes, immutable capture, anonymous/tampered/expired download denial and cleanup. It never substitutes local storage for R2. It was not run against a real bucket in this session. Release acceptance additionally requires browser CORS/expiry behavior, service outages, production permissions, and media recovery in a separate bucket. Never put signed URLs in application logs or test reports.

Format-2 encrypted backups include verified accepted bytes and checksums, plus the database, marker, identity key and configuration. Restore writes immutable objects beneath the new restore directory's `media/`; set `SCHOOL_LOCAL_STORAGE_PATH` there for an isolated local drill. It does not overwrite the production R2 bucket or claim offsite recovery. Preserve the recovery manifest, verify permissions and rehydrate a separately reviewed private R2 recovery bucket before production cutover. The current archive is constructed in memory; measure full-school capacity and recovery time before use at scale.
