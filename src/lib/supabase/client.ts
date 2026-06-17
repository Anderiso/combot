import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export function createBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Missing Supabase public environment variables");
  }

  return createClient<Database>(url, key);
}
