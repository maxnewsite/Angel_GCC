"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import type { AppRole } from "@/lib/roles";
import { INTERNAL_ROLES } from "@/lib/roles";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<AppRole | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    let mounted = true;

    async function load() {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      setEmail(session?.user?.email ?? null);

      if (session?.user?.id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role, avatar_url, full_name")
          .eq("id", session.user.id)
          .single();
        if (mounted) {
          setRole((profile?.role as AppRole) ?? null);
          setAvatarUrl(profile?.avatar_url ?? null);
          setFullName(profile?.full_name ?? null);
        }
      }
    }

    load();

    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const nav = [
    { href: "/app/deals", label: "Deals", show: true },
    { href: "/app/watchlist", label: "Watchlist", show: role === "investor" },
    { href: "/app/founder/deals", label: "Founder", show: role === "founder" },
    { href: "/app/founder/deals/new", label: "New Deal", show: role === "founder" },
    { href: "/app/dealflow/inbox", label: "Dealflow", show: role === "dealflow_manager" || role === "admin" },
    { href: "/app/deals/new", label: "New Deal", show: role === "dealflow_manager" || role === "admin" },
    { href: "/app/rejected", label: "Rejected", show: role === "dealflow_manager" || role === "ic_member" || role === "ic_chair" || role === "admin" },
    { href: "/app/ic/queue", label: "IC", show: role === "ic_member" || role === "ic_chair" || role === "admin" },
    { href: "/app/portfolio", label: "Portfolio", show: role === "dealflow_manager" || role === "ic_member" || role === "ic_chair" || role === "admin" },
    { href: "/app/analytics", label: "Analytics", show: role === "dealflow_manager" || role === "ic_member" || role === "ic_chair" || role === "admin" },
    { href: "/app/experts", label: "Experts", show: role === "dealflow_manager" || role === "ic_member" || role === "ic_chair" || role === "admin" },
    { href: "/app/admin/users", label: "Admin", show: role === "admin" },
  ].filter(x => x.show);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50">
      {/* Header with blue gradient */}
      <header className="sticky top-0 z-50 bg-gradient-to-r from-blue-700 via-blue-600 to-blue-700 shadow-lg backdrop-blur-xl border-b border-white/10">
        <div className="mx-auto max-w-6xl px-5 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="h-11 w-11 rounded-2xl bg-white text-blue-700 flex items-center justify-center font-bold text-lg shadow-lg group-hover:scale-105 transition-transform">
                A
              </div>
              <div>
                <div className="text-base font-semibold text-white">AngelOS</div>
                <div className="text-xs text-white/70">Investment Platform</div>
              </div>
            </Link>

            <div className="flex items-center gap-3">
              {role && (
                <div className="hidden sm:flex items-center gap-2 rounded-xl bg-white/10 backdrop-blur-xl px-4 py-2 border border-white/20">
                  <div className="w-2 h-2 rounded-full bg-green-400"></div>
                  <span className="text-sm text-white font-medium capitalize">
                    {role.replace(/_/g, ' ')}
                  </span>
                </div>
              )}

              {/* Profile Menu */}
              <div className="relative">
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="flex items-center gap-2 rounded-xl bg-white/10 backdrop-blur-xl border border-white/20 px-3 py-2 hover:bg-white/20 transition-all hover:scale-105"
                >
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={fullName || email || "Profile"}
                      className="h-8 w-8 rounded-full object-cover border-2 border-white/30"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-white/30 to-white/10 flex items-center justify-center text-white text-sm font-bold border-2 border-white/30">
                      {fullName?.charAt(0)?.toUpperCase() || email?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                  )}
                  <span className="hidden md:block text-sm text-white font-medium">
                    {fullName || email?.split("@")[0] || "Profile"}
                  </span>
                  <svg
                    className={`h-4 w-4 text-white transition-transform ${showProfileMenu ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showProfileMenu && (
                  <>
                    {/* Backdrop to close menu */}
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowProfileMenu(false)}
                    />
                    {/* Dropdown Menu */}
                    <div className="absolute right-0 mt-2 w-56 rounded-xl bg-white shadow-2xl border border-black/10 overflow-hidden z-50">
                      <div className="p-3 border-b border-black/10">
                        <div className="text-sm font-medium text-black">{fullName || "User"}</div>
                        <div className="text-xs text-black/60">{email}</div>
                      </div>
                      <div className="py-1">
                        <Link
                          href="/app/profile"
                          className="flex items-center gap-2 px-4 py-2 text-sm text-black hover:bg-black/5 transition-colors"
                          onClick={() => setShowProfileMenu(false)}
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          Profile Settings
                        </Link>
                        <button
                          onClick={async () => {
                            setShowProfileMenu(false);
                            try {
                              const { error } = await supabase.auth.signOut();
                              if (error && !error.message.includes("session")) {
                                console.error("Sign out error:", error);
                                alert("Error signing out: " + error.message);
                                return;
                              }
                              setRole(null);
                              setEmail(null);
                              setAvatarUrl(null);
                              setFullName(null);
                              localStorage.clear();
                              window.location.href = "/";
                            } catch (e) {
                              console.error("Sign out failed:", e);
                              localStorage.clear();
                              window.location.href = "/";
                            }
                          }}
                          className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                          Sign Out
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="mt-4 flex flex-wrap gap-2">
            {nav.map((i) => {
              const isActive = pathname === i.href || pathname?.startsWith(i.href + '/');
              return (
                <Link
                  key={i.href}
                  href={i.href}
                  className={`rounded-xl px-4 py-2 text-sm font-medium transition-all hover:scale-105 ${
                    isActive
                      ? 'bg-white text-blue-700 shadow-lg'
                      : 'bg-white/10 backdrop-blur-xl text-white border border-white/20 hover:bg-white/20'
                  }`}
                >
                  {i.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>
    </div>
  );
}
