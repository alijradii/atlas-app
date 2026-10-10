import { notFound } from "next/navigation";
import WorkspaceApp from "@/components/workspace/workspace-app";
export const metadata = { title: "Your Atlas workspace" };
export default async function WorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string | string[] }>;
}) {
  const { section = "home" } = await searchParams;
  if (
    typeof section !== "string" ||
    ![
      "home",
      "work",
      "lessons",
      "messages",
      "plans",
      "students",
      "assistant",
      "events",
      "connections",
      "reports",
    ].includes(section)
  )
    notFound();
  return <WorkspaceApp section={section} />;
}
