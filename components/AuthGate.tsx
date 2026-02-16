"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

interface AuthGateProps {
  children: React.ReactNode;
  requiredRole?: "founder" | "admin";
}

export function AuthGate({ children, requiredRole }: AuthGateProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (loading) router.replace("/auth");
    }, 10000);

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.replace("/auth");
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (!data) {
        router.replace("/auth");
        return;
      }

      if (requiredRole && data.role !== requiredRole) {
        router.replace(data.role === "admin" ? "/admin/dashboard" : "/founder/dashboard");
        return;
      }

      setProfile(data as Profile);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") router.replace("/auth");
    });

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [router, requiredRole, supabase, loading]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-blue-600 text-lg font-medium">Loading...</div>
      </div>
    );
  }

  return <>{children}</>;
}

export { type Profile };
