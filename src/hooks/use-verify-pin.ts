import { useCallback } from "react";
import { getBarberById } from "@/api/local";
import { accountEmail, getSupabase, isSupabaseConfigured } from "@/supabase";
import { hashPin, normalizeMobile } from "@/utils/pin";
import type { Session } from "@/hooks/use-auth";

/**
 * Re-verify the signed-in user's PIN, used to unmask sensitive values such as
 * salary figures. Works online (Supabase password check) and in local-only mode
 * (PIN hash comparison).
 */
export function useVerifyPin(session: Session | null) {
  return useCallback(
    async (pin: string): Promise<boolean> => {
      if (!session) return false;
      if (!/^\d{6}$/.test(pin)) return false;

      if (isSupabaseConfigured) {
        // A fresh password grant verifies the PIN without disturbing the session.
        const { error } = await getSupabase().auth.signInWithPassword({
          email: accountEmail(session.mobile),
          password: pin,
        });
        return !error;
      }

      const barber = await getBarberById(session.barberId);
      if (!barber?.pinHash) return false;
      const hash = await hashPin(normalizeMobile(session.mobile), pin);
      return hash === barber.pinHash;
    },
    [session],
  );
}
