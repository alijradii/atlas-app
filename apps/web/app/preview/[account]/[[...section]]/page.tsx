import { notFound } from "next/navigation";
import {
  type AccountId,
  fixture,
  navigation,
  type Role,
} from "@/components/preview/data";
import { Workspace } from "@/components/preview/workspace";
export default async function PreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ account: string; section?: string[] }>;
  searchParams: Promise<{ prompt?: string | string[] }>;
}) {
  const { account, section = [] } = await params;
  if (!Object.hasOwn(fixture.accounts, account)) notFound();
  const accountId = account as AccountId;
  const [view = "home", item] = section;
  const role = fixture.accounts[accountId].role as Role;
  const simple =
    navigation[role].some(([slug]) => slug === view) || view === "chat";
  const lesson =
    view === "lesson" &&
    (role === "student" || role === "teacher") &&
    fixture.lessons.some((l) => l.id === item);
  const student =
    view === "student" &&
    role === "adviser" &&
    fixture.caseload.some((s) => s.id === item);
  if (
    !(simple && section.length <= 1) &&
    !((lesson || student) && section.length === 2)
  )
    notFound();
  const { prompt } = await searchParams;
  return (
    <Workspace
      accountId={accountId}
      section={view}
      item={item}
      prompt={typeof prompt === "string" ? prompt.slice(0, 1000) : undefined}
    />
  );
}
