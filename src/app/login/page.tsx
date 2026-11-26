import { redirect } from "next/navigation";
import { getViewer } from "@/auth/viewer";
import { loginRequired } from "@/auth/session";
import { LoginForm } from "./LoginForm";
import { NitcoLogo } from "@/components/Logo";

export default async function Login({ searchParams }: PageProps<"/login">) {
  if (!loginRequired() || (await getViewer())) redirect("/");
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "/";
  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="w-full max-w-[380px]">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="mb-7">
            <NitcoLogo full height={56} />
          </div>
          <h1 className="headline">Display Tracker</h1>
          <p className="text-[13.5px] text-ink-2 mt-1.5">Sign in to see how displays turn into sales.</p>
        </div>
        <LoginForm next={next} />
        <p className="text-[12.5px] text-ink-3 mt-5 text-center">For access or a new password, contact the Display Tracker admin.</p>
      </div>
    </div>
  );
}
