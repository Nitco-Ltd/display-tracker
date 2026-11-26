"use client";
import { useActionState } from "react";
import { login, type LoginState } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  return (
    <form action={action} className="card p-6 space-y-4">
      <input type="hidden" name="next" value={next} />
      <label className="block">
        <span className="label">Email</span>
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          className="mt-1.5 w-full rounded-[8px] border border-line bg-surface-1 px-3 h-10 text-[14px] outline-none focus:border-[var(--ink-strong)] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--ink-strong)_8%,transparent)]"
        />
      </label>
      <label className="block">
        <span className="label">Password</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1.5 w-full rounded-[8px] border border-line bg-surface-1 px-3 h-10 text-[14px] outline-none focus:border-[var(--ink-strong)] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--ink-strong)_8%,transparent)]"
        />
      </label>
      {state.error && (
        <div role="alert" className="text-[13px]" style={{ color: "var(--status-critical)" }}>
          {state.error}
        </div>
      )}
      <button disabled={pending} className="btn btn-primary w-full h-10 !text-[13.5px]">
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
