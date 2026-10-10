import status from "../docs/release-status.json";

if (!status.productionApproved) {
  console.error(
    `Production release blocked: ${status.reason}\n${status.source}`,
  );
  process.exit(1);
}
