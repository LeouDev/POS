import type { Metadata } from "next";
import Link from "next/link";
import { LoginWindow } from "./login-window";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage(props: PageProps<"/login">) {
  const { next, error, mode } = await props.searchParams;
  return (
    <main className="flex min-h-dvh flex-col items-center justify-start gap-3 px-2 py-6 sm:justify-center sm:px-4">
      <LoginWindow
        next={typeof next === "string" ? next : "/dashboard"}
        linkError={typeof error === "string" ? error : undefined}
        startOnSignUp={mode === "signup"}
      />
      <nav aria-label="KASSIX site" className="flex flex-wrap justify-center gap-x-4 text-[12px] [&_a]:text-white">
        <Link href="/">KASSIX home</Link>
        <Link href="/terms">Terms</Link>
        <Link href="/privacy">Privacy</Link>
      </nav>
    </main>
  );
}
