"use client";

import { AuthGate } from "@/components/AuthGate";
import { AppShell } from "@/components/AppShell";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate requiredRole="admin">
      <AppShell role="admin">{children}</AppShell>
    </AuthGate>
  );
}
