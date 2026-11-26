"use client";
import { useActionState } from "react";
import { login, type LoginState } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  return (
    <form action={action} className="card p-7 space-y-4" style={{ boxShadow: "var(--shadow-md)" }}>
      <input type="hidden" name="next" value={next} />
      <label className="block">
        <span className="text-[12.5px] font-medium text-ink-2">Email</span>
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          className="mt-1.5 w-full rounded-[12px] border border-transparent bg-surface-2 px-3.5 h-11 text-[15px] outline-none focus:bg-surface-1 focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-soft)]"
        />
      </label>
      <label className="block">
        <span className="text-[12.5px] font-medium text-ink-2">Password</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1.5 w-full rounded-[12px] border border-transparent bg-surface-2 px-3.5 h-11 text-[15px] outline-none focus:bg-surface-1 focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-soft)]"
        />
      </label>
      {state.error && (
        <div role="alert" className="text-[13px]" style={{ color: "var(--status-critical)" }}>
          {state.error}
        </div>
      )}
      <button disabled={pending} className="btn btn-primary w-full h-11 text-[15px]">
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
