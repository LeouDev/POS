import { KeyRound } from "lucide-react";
import type { Metadata } from "next";
import { TitleBar } from "@/components/ui";
import { getSession } from "@/lib/data";
import { NewPasswordForm } from "./new-password-form";

export const metadata: Metadata = { title: "Choose a new password" };

/** Where the password reset link lands (signed in by the link). */
export default async function ResetPasswordPage() {
  const { email } = await getSession();
  return (
    <main className="flex min-h-dvh items-start justify-center px-2 py-6 sm:items-center sm:px-4">
      <section className="window window-shadow w-full max-w-[420px]">
        <TitleBar title="Choose a new password" icon={KeyRound} />
        <div className="flex flex-col gap-3 p-3">
          <p className="text-[13px]">
            Choose a new password for <b>{email}</b>. You&apos;ll use it the next time you sign in.
          </p>
          <NewPasswordForm />
        </div>
      </section>
    </main>
  );
}
