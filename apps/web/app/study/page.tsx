import StudyApp from "@/components/study/study-app";

export const metadata = { title: "Your study workspace" };

export default async function StudyPage({
  searchParams,
}: {
  searchParams: Promise<{
    new?: string | string[];
    lesson?: string | string[];
    materials?: string | string[];
  }>;
}) {
  const params = await searchParams;
  return (
    <StudyApp
      newConversation={params.new === "1"}
      materialsOnly={params.materials === "1"}
      initialLessonId={
        typeof params.lesson === "string" ? params.lesson : undefined
      }
    />
  );
}
