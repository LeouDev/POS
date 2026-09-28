import type { ReactNode } from "react";
import { Shell } from "@/components/shell";
import { getProfile, getSession } from "@/lib/data";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const [{ email }, profile] = await Promise.all([getSession(), getProfile()]);
  return (
    <Shell businessName={profile.business_name} email={email} timezone={profile.timezone}>
      {children}
    </Shell>
  );
}
