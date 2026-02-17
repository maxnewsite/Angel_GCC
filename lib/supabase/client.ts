import { createBrowserClient } from "@supabase/ssr";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://pkwbzhucmhfaoljugmgs.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBrd2J6aHVjbWhmYW9sanVnbWdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNDI4ODYsImV4cCI6MjA4NjgxODg4Nn0.P7Zg2_yS-h5fNY8mAi2TydW_jZtT6hDSZq_JJhwKfv8";

export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
