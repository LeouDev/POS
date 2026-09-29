import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";

// Landing page for email links (sign-up confirmation, password reset). Handles both the PKCE `code`
// (default Supabase templates) and `token_hash` (supabase/templates/, which also work on another device).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const supabase = await createClient();

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { error: new Error("missing code") };

  if (!error) return NextResponse.redirect(new URL(safeNext(searchParams.get("next")), origin));
  const login = new URL("/login", origin);
  login.searchParams.set("error", "That link is invalid or has expired. Sign in, or ask for a new link.");
  return NextResponse.redirect(login);
}
