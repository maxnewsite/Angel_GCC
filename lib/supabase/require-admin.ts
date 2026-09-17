import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Verifies the request carries a Supabase access token belonging to an admin.
 * Returns null when authorised, otherwise an error Response to return as-is.
 */
export async function requireAdmin(
  request: NextRequest,
  supabase: SupabaseClient
): Promise<Response | null> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return jsonError("Not authenticated", 401);

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return jsonError("Session expired — please sign in again", 401);

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") return jsonError("Admin access required", 403);

  return null;
}

function jsonError(error: string, status: number): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
