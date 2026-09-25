import { createClient } from "@supabase/supabase-js";

// Server-only client. Uses the service-role key and must never be imported
// from a "use client" component or otherwise reach the browser bundle --
// supabase/schema.sql leaves RLS off on the assumption that this key stays
// server-side only.
function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (see .env.local.example)."
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

let cached: ReturnType<typeof getSupabaseAdmin> | null = null;

export function supabaseAdmin() {
  if (!cached) cached = getSupabaseAdmin();
  return cached;
}
