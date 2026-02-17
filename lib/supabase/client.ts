import { createBrowserClient } from "@supabase/ssr";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://pkwbzhucmhfaoljugmgs.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBrd2J6aHVjbWhmYW9sanVnbWdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzUwNDMxMjAsImV4cCI6MjA1MDYxOTEyMH0.XLQ5F8bBqmqGM4WxzqiPc1sTiGhxhsQJHkb0ozDi7WQ";

export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
