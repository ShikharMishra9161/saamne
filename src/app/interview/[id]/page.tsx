import { redirect } from "next/navigation";
import { Room } from "@/components/room/Room";
import { currentUser } from "@/lib/auth";

export default async function InterviewRoom({ params }: PageProps<"/interview/[id]">) {
  if (!(await currentUser())) redirect("/login");
  const { id } = await params;
  return (
    <main className="flex min-h-[100dvh] flex-col">
      <Room id={id} />
    </main>
  );
}
