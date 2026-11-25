// Sends anyone without a valid sign-in to /login (pages) or answers 401 (API), before any page renders.
// Pages and API routes check the viewer again (src/auth/viewer.ts): this is the first gate, not the only one.
import { NextResponse, type NextRequest } from "next/server";
import { loginRequired, readSessionToken, SESSION_COOKIE } from "@/auth/session";

export function proxy(req: NextRequest) {
  if (!loginRequired()) return NextResponse.next();
  if (readSessionToken(req.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();
  if (req.nextUrl.pathname.startsWith("/api/")) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const url = new URL("/login", req.url);
  const back = req.nextUrl.pathname + req.nextUrl.search;
  if (back !== "/") url.searchParams.set("next", back);
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except the sign-in page itself and Next.js static assets.
  matcher: ["/((?!login|_next/static|_next/image|favicon.ico).*)"],
};
