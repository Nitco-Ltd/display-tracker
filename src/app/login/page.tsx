import { redirect } from "next/navigation";
import { getViewer } from "@/auth/viewer";
import { loginRequired } from "@/auth/session";
import { LoginForm } from "./LoginForm";

export default async function Login({ searchParams }: PageProps<"/login">) {
  if (!loginRequired() || (await getViewer())) redirect("/");
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "/";
  return (
    <div className="max-w-[360px] mx-auto pt-10">
      <h1 className="text-[18px] font-semibold mb-1">Sign in</h1>
      <p className="text-[13px] text-ink-2 mb-4">Use the email and password you were given for Display Tracker.</p>
      <LoginForm next={next} />
      <p className="text-[12px] text-ink-3 mt-4">No account, or forgot your password? Ask the Display Tracker admin.</p>
    </div>
  );
}
