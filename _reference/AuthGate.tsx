"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    let mounted = true;
    let redirecting = false;

    async function check() {
      try {
        // Add timeout to prevent infinite loading
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Auth check timeout")), 10000)
        );

        const sessionPromise = supabase.auth.getSession();

        const { data, error } = await Promise.race([
          sessionPromise,
          timeoutPromise
        ]) as any;

        if (!mounted) return;

        if (error) {
          console.error("Auth check error:", error);
          setAuthed(false);
          setLoading(false);
          return;
        }

        const hasSession = !!data.session;
        setAuthed(hasSession);
        setLoading(false);

        // Redirect to auth if not authenticated
        if (!hasSession && !redirecting) {
          redirecting = true;
          router.push("/auth");
        }
      } catch (e) {
        console.error("Auth gate error:", e);
        if (mounted) {
          // Failsafe: If auth check fails, assume not authenticated
          setAuthed(false);
          setLoading(false);
          if (!redirecting) {
            redirecting = true;
            router.push("/auth");
          }
        }
      }
    }

    check();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      console.log("Auth state change:", event);

      if (event === "SIGNED_OUT") {
        setAuthed(false);
        if (!redirecting) {
          redirecting = true;
          router.push("/auth");
        }
      } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        setAuthed(!!session);
      } else {
        check();
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-sm text-black/60">Loading…</div>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-sm text-black/60">Redirecting to login...</div>
      </div>
    );
  }

  return <>{children}</>;
}
