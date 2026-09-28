import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/auth"];

// Refreshes the Supabase session cookie on every request and keeps signed-out
// visitors on the login page. Data access is still enforced by RLS.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return response; // pages render the configuration error

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [name, value] of Object.entries(headers ?? {})) response.headers.set(name, value);
      },
    },
  });

  // Confirmation links fall back to the Site URL root when the callback isn't allow-listed.
  if (request.nextUrl.pathname === "/" && request.nextUrl.searchParams.has("code")) {
    return NextResponse.redirect(new URL(`/auth/callback${request.nextUrl.search}`, request.url));
  }

  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);
  const { pathname, search } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  let redirectTo: URL | null = null;
  if (!signedIn && !isPublic) {
    redirectTo = new URL("/login", request.url);
    if (pathname !== "/") redirectTo.searchParams.set("next", pathname + search);
  } else if (signedIn && pathname === "/login") {
    redirectTo = new URL("/dashboard", request.url);
  }
  if (!redirectTo) return response;

  const redirect = NextResponse.redirect(redirectTo);
  for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icon.png|apple-icon.png|kassix-logo.webp).*)"],
};
