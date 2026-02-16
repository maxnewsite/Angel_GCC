"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";

interface AppShellProps {
  children: React.ReactNode;
  role: "founder" | "admin";
}

const NAV_ITEMS = {
  founder: [
    { label: "Dashboard", href: "/founder/dashboard" },
    { label: "New Submission", href: "/founder/submit" },
  ],
  admin: [
    { label: "Dashboard", href: "/admin/dashboard" },
  ],
};

export function AppShell({ children, role }: AppShellProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single();
        if (data) setProfile(data as Profile);
      }
    });
  }, [supabase]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/auth");
  }

  const navItems = NAV_ITEMS[role];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-gradient-to-r from-blue-700 via-blue-600 to-blue-700 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-6">
              <div>
                <h1 className="text-xl font-bold text-white">Angel AI Analyst</h1>
                <p className="text-[10px] text-blue-200 -mt-0.5">Investment Analysis Platform</p>
              </div>
              <nav className="flex gap-1">
                {navItems.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <button
                      key={item.href}
                      onClick={() => router.push(item.href)}
                      className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                        active
                          ? "bg-white text-blue-700 shadow"
                          : "text-white/80 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </nav>
            </div>
            <div className="flex items-center gap-4">
              <Badge variant={role === "admin" ? "destructive" : "secondary"}>
                {role}
              </Badge>
              {profile && (
                <span className="text-sm text-blue-100">{profile.email}</span>
              )}
              <button
                onClick={handleSignOut}
                className="rounded-lg px-3 py-1.5 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-all"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">{children}</main>
    </div>
  );
}
