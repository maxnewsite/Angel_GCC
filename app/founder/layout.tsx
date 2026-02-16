"use client";

import { AuthGate } from "@/components/AuthGate";
import { AppShell } from "@/components/AppShell";

export default function FounderLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate requiredRole="founder">
      <AppShell role="founder">{children}</AppShell>
    </AuthGate>
  );
}
