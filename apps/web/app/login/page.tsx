import FilesApp from "@/components/files-app";
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const query = await searchParams;
  return <FilesApp afterLogin={query.next === "study" ? "/study" : "/files"} />;
}
