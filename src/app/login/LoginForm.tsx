"use client";
import { useActionState } from "react";
import { login, type LoginState } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  return (
    <form action={action} className="card p-5 space-y-3">
      <input type="hidden" name="next" value={next} />
      <label className="block">
        <span className="text-[12px] text-ink-2">Email</span>
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          className="mt-1 w-full rounded-md border border-line bg-surface-1 px-3 py-2 text-[14px]"
        />
      </label>
      <label className="block">
        <span className="text-[12px] text-ink-2">Password</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1 w-full rounded-md border border-line bg-surface-1 px-3 py-2 text-[14px]"
        />
      </label>
      {state.error && (
        <div role="alert" className="text-[13px]" style={{ color: "var(--status-critical)" }}>
          {state.error}
        </div>
      )}
      <button disabled={pending} className="w-full rounded-md px-4 py-2 text-[13px] font-medium bg-accent text-white disabled:opacity-60">
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
