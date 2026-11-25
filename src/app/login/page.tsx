import { redirect } from "next/navigation";
import { getViewer } from "@/auth/viewer";
import { loginRequired } from "@/auth/session";
import { LoginForm } from "./LoginForm";

export default async function Login({ searchParams }: PageProps<"/login">) {
  if (!loginRequired() || (await getViewer())) redirect("/");
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "/";
  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="w-full max-w-[380px]">
        <div className="flex flex-col items-center text-center mb-6">
          <div
            className="h-12 w-12 rounded-[14px] flex items-center justify-center text-white font-bold text-[22px] mb-4"
            style={{ background: "var(--brand)", boxShadow: "var(--shadow-lg)" }}
            aria-hidden
          >
            N
          </div>
          <h1 className="text-[22px] font-semibold tracking-tight">Sign in to Display Tracker</h1>
          <p className="text-[13.5px] text-ink-2 mt-1.5">Displays from the RMI app, sales from SAP, in one place.</p>
        </div>
        <LoginForm next={next} />
        <p className="text-[12.5px] text-ink-3 mt-5 text-center">No account, or forgot your password? Ask the Display Tracker admin.</p>
      </div>
    </div>
  );
}
