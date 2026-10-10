import { notFound } from "next/navigation";
import { connection } from "next/server";
import { PreviewProvider } from "../../components/preview/state";

/** Fixture screens only exist in the isolated browser regression harness. */
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  await connection();
  if (process.env.SCHOOL_E2E !== "1") notFound();
  return <PreviewProvider>{children}</PreviewProvider>;
}
