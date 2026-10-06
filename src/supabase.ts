import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Vite only exposes `VITE_*` by default; `vite.config.ts` also enables
// `NEXT_PUBLIC_*` so the same names work whether you're used to Next or Vite.
const env = import.meta.env as Record<string, string | undefined>;

const url = env.VITE_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  env.VITE_SUPABASE_ANON_KEY ??
  env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** True when the Supabase URL + public key are present at build time. */
export const isSupabaseConfigured = Boolean(url && key);

let client: SupabaseClient | null = null;

/**
 * Lazily create the shared browser Supabase client.
 *
 * This is a client-only Vite SPA, so we use `createClient` from
 * `@supabase/supabase-js` (not `@supabase/ssr`, which targets cookie-based auth
 * in SSR frameworks such as Next.js). Sessions persist in localStorage, so the
 * app still opens while offline.
 */
export function getSupabase(): SupabaseClient {
  if (!url || !key) {
    throw new Error(
      "Supabase is not configured (set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY)",
    );
  }
  if (!client) {
    client = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storageKey: "salonos-auth",
      },
    });
  }
  return client;
}

/** Country code prepended to the local mobile number typed at sign-in. */
export const authPhonePrefix =
  env.VITE_AUTH_PHONE_PREFIX ?? env.NEXT_PUBLIC_AUTH_PHONE_PREFIX ?? "+960";

/**
 * Domain used to turn a mobile number into a synthetic auth email
 * (e.g. 9990001 -> 9990001@salonos.app) so we can use Supabase's Email
 * provider without SMS or a phone provider.
 */
export const authEmailDomain =
  env.VITE_AUTH_EMAIL_DOMAIN ?? env.NEXT_PUBLIC_AUTH_EMAIL_DOMAIN ?? "salonos.app";

/**
 * Canonical form of a typed mobile number: digits only, with a leading country
 * code removed. So `9990001`, `+960 999 0001` and `9609990001` all collapse to
 * `9990001`.
 */
export function canonicalMobile(input: string): string {
  const prefix = authPhonePrefix.replace(/\D/g, "");
  let digits = input.replace(/\D/g, "");
  if (prefix && digits.startsWith(prefix)) digits = digits.slice(prefix.length);
  return digits;
}

/** The synthetic Supabase email for a mobile number (or a real email, as-is). */
export function accountEmail(input: string): string {
  const value = input.trim().toLowerCase();
  if (value.includes("@")) return value;
  return `${canonicalMobile(value)}@${authEmailDomain}`;
}
