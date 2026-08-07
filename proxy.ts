import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Next.js 16 renamed middleware.ts -> proxy.ts (exported function `proxy`, not `middleware`).
// A stray middleware.ts is silently ignored at build time, so this file is the real one.
//
// Scope is deliberately narrow: refresh the session cookie, and redirect for the two routes
// this milestone actually protects at the edge. Every server action re-checks identity/
// permission itself, and RLS is the last line of defense -- this is a network boundary,
// not the authorization system.

const PROTECTED_PATHS = ["/experience-builder", "/capture", "/onboarding", "/admin"];
// "/workforce" was here from Phase 1 (module shell, before /workforce itself had to be a public
// homepage per the required Workforce architecture) -- it unconditionally redirected every signed-
// out request anywhere under /workforce/* to Q4K's own /login at the edge, before Next.js ever
// rendered the public homepage or the branded /workforce/login page. Every page under /workforce
// that actually needs auth (the Decision Pool and everything past it) already has its own
// server-side `if (!user) redirect("/workforce/login")` check, matching this file's own stated
// philosophy ("a network boundary, not the authorization system") -- removing it here doesn't
// remove protection, it just stops double-enforcing it at the wrong layer with the wrong
// destination.
const AUTH_PATHS = ["/login", "/signup"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  // Not configured yet -- let requests through unchanged rather than failing every page.
  if (!url || !publishableKey) {
    return response;
  }

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // getClaims() verifies the token; getSession() must never be trusted for route protection.
  const { data, error } = await supabase.auth.getClaims();
  const isAuthed = !error && !!data?.claims;

  const { pathname } = request.nextUrl;

  if (!isAuthed && PROTECTED_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const redirectUrl = new URL("/login", request.url);
    return NextResponse.redirect(redirectUrl);
  }

  if (isAuthed && AUTH_PATHS.some((p) => pathname === p)) {
    const redirectUrl = new URL("/dashboard", request.url);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static assets and image optimization files.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
