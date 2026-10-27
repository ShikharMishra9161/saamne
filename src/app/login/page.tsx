import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { Nav } from "@/components/Nav";
import { currentUser } from "@/lib/auth";

export default async function Page() {
  if (await currentUser()) redirect("/");
  return (
    <>
      <Nav />
      <main className="flex flex-1 items-center px-5 py-16">
        <AuthForm mode="login" />
      </main>
    </>
  );
}
