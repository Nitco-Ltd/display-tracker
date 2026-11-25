"use server";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb, tables } from "@/db/client";
import { ensureSchema } from "@/db/migrate";
import { createSessionToken, SESSION_COOKIE, SESSION_DAYS, verifyPassword } from "@/auth/session";
import { viewerByEmail } from "@/auth/viewer";

// Checked when the email is unknown, so a wrong email takes as long as a wrong password.
const DUMMY_HASH = "scrypt$" + "A".repeat(22) + "==$" + "A".repeat(86) + "==";

export interface LoginState {
  error?: string;
}

/** Only same-site paths, never another host. */
function safeNext(v: FormDataEntryValue | null): string {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/login") ? s : "/";
}

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };
  await ensureSchema();
  const t = tables();
  const [u] = await getDb().select().from(t.appUser).where(eq(t.appUser.email, email));
  // Same message and similar work whether the user exists or not.
  const ok = verifyPassword(password, u?.passwordHash ?? DUMMY_HASH) && !!u;
  if (!ok || !(await viewerByEmail(email))) {
    await new Promise((r) => setTimeout(r, 800)); // slows down password guessing
    return { error: "Email or password is wrong, or your access is switched off." };
  }
  (await cookies()).set(SESSION_COOKIE, createSessionToken(email), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
  redirect(safeNext(form.get("next")));
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
