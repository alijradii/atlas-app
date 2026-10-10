import FilesApp from "@/components/files-app";
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const query = await searchParams;
  return (
    <FilesApp
      afterLogin={
        query.next === "account"
          ? "/account"
          : query.next === "workspace"
            ? "/workspace"
            : query.next === "study"
              ? "/study"
              : query.next === "files"
                ? "/files"
                : "/workspace"
      }
    />
  );
}
