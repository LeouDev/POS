import type { Metadata } from "next";
import { LoginWindow } from "./login-window";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage(props: PageProps<"/login">) {
  const { next, error } = await props.searchParams;
  return (
    <main className="flex min-h-dvh items-start justify-center px-2 py-6 sm:items-center sm:px-4">
      <LoginWindow next={typeof next === "string" ? next : "/dashboard"} linkError={typeof error === "string" ? error : undefined} />
    </main>
  );
}
