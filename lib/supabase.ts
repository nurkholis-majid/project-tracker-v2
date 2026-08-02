import { createBrowserClient } from "@supabase/ssr";

/** Client Supabase untuk komponen browser. Auth-nya lewat cookie, jadi middleware bisa baca session. */
export const supabase = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
