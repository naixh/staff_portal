import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import {
  createBarber,
  getBarberById,
  getBarberByPhone,
  updateBarber,
} from "@/api/local";
import { barbersKey } from "@/hooks/use-barbers";
import {
  accountEmail,
  authPhonePrefix,
  canonicalMobile,
  getSupabase,
  isSupabaseConfigured,
} from "@/supabase";
import { syncEngine } from "@/sync/engine";
import type { StaffType } from "@/models/types";
import { hashPin, isValidMobile, isValidPin, normalizeMobile } from "@/utils/pin";

const LOCAL_KEY = "salonos_session";

export type Role = "owner" | "admin" | "staff";

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  staff: "Staff",
};

/** Owners and admins can approve users and manage the team. */
export function canManageTeam(role: Role | null | undefined): boolean {
  return role === "owner" || role === "admin";
}

export interface Session {
  /** Supabase auth user id (null when using the offline local fallback). */
  userId: string | null;
  barberId: string;
  name: string;
  mobile: string;
  role: Role;
  /** Which part of the business this account works in. */
  department: StaffType;
  /** False until an admin approves the account. Always true locally. */
  approved: boolean;
}

export interface AuthResult {
  ok: boolean;
  error?: string;
}

interface AuthContextValue {
  session: Session | null;
  /** False only while the Supabase session is being restored on first load. */
  ready: boolean;
  signIn: (mobile: string, pin: string) => Promise<AuthResult>;
  register: (input: {
    name: string;
    mobile: string;
    pin: string;
  }) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  /** Re-read the current profile (used by the "awaiting approval" screen). */
  refresh: () => Promise<void>;
  /** Change the signed-in user's display name. */
  updateName: (name: string) => Promise<boolean>;
}

interface ProfileRow {
  name: string | null;
  phone: string | null;
  role: string | null;
  department: string | null;
  approved: boolean | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** True when the typed identifier is an email rather than a mobile number. */
function looksLikeEmail(value: string): boolean {
  return value.includes("@");
}

function readLocalSession(): Session | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

/** Store the full E.164 number in user metadata for display. */
function phoneFor(input: string): string {
  return `${authPhonePrefix}${canonicalMobile(input)}`;
}

async function fetchProfile(userId: string): Promise<ProfileRow | null> {
  const supabase = getSupabase();
  const full = await supabase
    .from("profiles")
    .select("name,phone,role,department,approved")
    .eq("id", userId)
    .maybeSingle();
  if (!full.error) return (full.data as ProfileRow | null) ?? null;

  // Older schema without `department` (migration 0007 not applied yet): falling
  // back keeps everyone signed in and approved instead of locking them out.
  const legacy = await supabase
    .from("profiles")
    .select("name,phone,role,approved")
    .eq("id", userId)
    .maybeSingle();
  if (legacy.error) return null;
  const row = legacy.data as Omit<ProfileRow, "department"> | null;
  return row ? { ...row, department: "salon" } : null;
}

/** Map terse Supabase auth errors to friendlier copy. */
function friendlyAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("invalid login")) return "Incorrect mobile number or PIN";
  if (lower.includes("already registered") || lower.includes("duplicate")) {
    return "That mobile number is already registered";
  }
  if (lower.includes("email not confirmed")) {
    return "Confirm your email (or disable email confirmation in Supabase Auth settings)";
  }
  if (lower.includes("password")) return "PIN must be 6 digits";
  return message;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const refreshBarbers = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: barbersKey });
    syncEngine.schedule();
  }, [queryClient]);

  const [localSession, setLocalSession] = useState<Session | null>(readLocalSession);
  const [remoteSession, setRemoteSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!isSupabaseConfigured);

  const persistLocal = useCallback((next: Session | null) => {
    try {
      if (next) localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
      else localStorage.removeItem(LOCAL_KEY);
    } catch {
      // Ignore storage failures (private mode, etc.).
    }
    setLocalSession(next);
  }, []);

  /** Resolve an auth user into an app session (loads role + approval). */
  const applyUser = useCallback(async (user: User | null) => {
    if (!user) {
      setRemoteSession(null);
      setReady(true);
      return;
    }
    const profile = await fetchProfile(user.id);
    const meta = (user.user_metadata ?? {}) as { name?: string; phone?: string };
    const emailLocal = user.email?.split("@")[0] ?? "";
    setRemoteSession({
      userId: user.id,
      barberId: user.id,
      name: profile?.name || meta.name || emailLocal || "User",
      mobile: profile?.phone || meta.phone || user.email || "",
      role: profile?.role === "owner" ? "owner" : profile?.role === "admin" ? "admin" : "staff",
      department: profile?.department || "salon",
      approved: profile?.approved ?? false,
    });
    setReady(true);
  }, []);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    const { data } = await getSupabase().auth.getUser();
    await applyUser(data.user ?? null);
  }, [applyUser]);

  // Restore / track the Supabase session.
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = getSupabase();
    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (active) void applyUser(data.session?.user ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      void applyUser(next?.user ?? null);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [applyUser]);

  // While awaiting approval, poll so the user is let in as soon as an admin approves.
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    if (!remoteSession || remoteSession.approved) return;
    const timer = setInterval(() => void refresh(), 8000);
    return () => clearInterval(timer);
  }, [remoteSession, refresh]);

  /** Make sure a barber record exists for the signed-in account. */
  const ensureBarber = useCallback(
    async (active: Session) => {
      const existing = await getBarberById(active.barberId);
      if (existing) {
        const stale =
          existing.deleted ||
          existing.name !== active.name ||
          (existing.phone ?? "") !== (active.mobile ?? "");
        if (stale) {
          // Keep the roster entry in sync with the account (and un-delete it if
          // it was removed earlier).
          await updateBarber(existing.id, {
            name: active.name,
            phone: active.mobile || undefined,
            deleted: false,
          });
          refreshBarbers();
        }
        return;
      }
      await createBarber({
        id: active.barberId,
        name: active.name,
        phone: active.mobile || undefined,
      });
      refreshBarbers();
    },
    [refreshBarbers],
  );

  const session = isSupabaseConfigured ? remoteSession : localSession;

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    if (!remoteSession || !remoteSession.approved) {
      syncEngine.setUserId(null);
      return;
    }
    syncEngine.setUserId(remoteSession.userId);
    void ensureBarber(remoteSession);
  }, [remoteSession, ensureBarber]);

  const signIn = useCallback(
    async (mobile: string, pin: string): Promise<AuthResult> => {
      const identifier = mobile.trim();
      if (!identifier) {
        return { ok: false, error: "Enter your mobile number or email" };
      }
      const asEmail = looksLikeEmail(identifier);
      if (asEmail) {
        if (!EMAIL_RE.test(identifier)) {
          return { ok: false, error: "Enter a valid email" };
        }
      } else if (!isValidMobile(normalizeMobile(identifier))) {
        return { ok: false, error: "Enter a valid mobile number" };
      }
      if (!isValidPin(pin)) {
        return { ok: false, error: "PIN must be 6 digits" };
      }

      if (isSupabaseConfigured) {
        const { error } = await getSupabase().auth.signInWithPassword({
          email: accountEmail(identifier),
          password: pin,
        });
        if (error) return { ok: false, error: friendlyAuthError(error.message) };
        return { ok: true };
      }

      // Offline local fallback (mobile numbers only — emails need Supabase).
      if (asEmail) {
        return {
          ok: false,
          error:
            "Email sign-in needs the Supabase backend — this build has no backend configured.",
        };
      }
      const digits = normalizeMobile(identifier);
      const barber = await getBarberByPhone(digits);
      if (!barber) {
        return { ok: false, error: "No account for this number. Create one." };
      }
      const pinHash = await hashPin(digits, pin);
      if (barber.pinHash && barber.pinHash !== pinHash) {
        return { ok: false, error: "Incorrect PIN" };
      }
      if (!barber.pinHash) {
        await updateBarber(barber.id, { phone: digits, pinHash });
        refreshBarbers();
      }
      persistLocal({
        userId: null,
        barberId: barber.id,
        name: barber.name,
        mobile: digits,
        role: "owner",
        department: "salon",
        approved: true,
      });
      return { ok: true };
    },
    [persistLocal, refreshBarbers],
  );

  const register = useCallback(
    async (input: {
      name: string;
      mobile: string;
      pin: string;
    }): Promise<AuthResult> => {
      const identifier = input.mobile.trim();
      const name = input.name.trim();
      const digits = normalizeMobile(identifier);
      const asEmail = looksLikeEmail(identifier);
      if (!name) return { ok: false, error: "Enter your name" };
      if (!identifier) {
        return { ok: false, error: "Enter your mobile number or email" };
      }
      if (asEmail) {
        if (!EMAIL_RE.test(identifier)) {
          return { ok: false, error: "Enter a valid email" };
        }
      } else if (!isValidMobile(digits)) {
        return { ok: false, error: "Enter a valid mobile number" };
      }
      if (!isValidPin(input.pin)) {
        return { ok: false, error: "PIN must be 6 digits" };
      }

      if (isSupabaseConfigured) {
        const { data, error } = await getSupabase().auth.signUp({
          email: accountEmail(identifier),
          password: input.pin,
          options: {
            data: asEmail ? { name } : { name, phone: phoneFor(identifier) },
          },
        });
        if (error) return { ok: false, error: friendlyAuthError(error.message) };
        if (!data.session) {
          return {
            ok: false,
            error:
              "Account created — disable email confirmation in Supabase (Auth → Providers → Email) to sign in immediately.",
          };
        }
        return { ok: true };
      }

      // Offline local fallback (mobile numbers only — emails need Supabase).
      if (asEmail) {
        return {
          ok: false,
          error:
            "Email accounts need the Supabase backend — this build has no backend configured.",
        };
      }
      const existing = await getBarberByPhone(digits);
      if (existing) {
        return { ok: false, error: "That mobile number is already registered" };
      }
      const pinHash = await hashPin(digits, input.pin);
      const barber = await createBarber({ name, phone: digits, pinHash });
      refreshBarbers();
      persistLocal({
        userId: null,
        barberId: barber.id,
        name: barber.name,
        mobile: digits,
        role: "owner",
        department: "salon",
        approved: true,
      });
      return { ok: true };
    },
    [persistLocal, refreshBarbers],
  );

  const signOut = useCallback(async () => {
    if (isSupabaseConfigured) {
      await getSupabase().auth.signOut();
      return;
    }
    persistLocal(null);
  }, [persistLocal]);

  const updateName = useCallback(
    async (input: string): Promise<boolean> => {
      const name = input.trim();
      if (!name) return false;

      if (isSupabaseConfigured) {
        const { data } = await getSupabase().auth.getUser();
        const user = data.user;
        if (!user) return false;
        const { error } = await getSupabase()
          .from("profiles")
          .update({ name })
          .eq("id", user.id);
        if (error) return false;
        await updateBarber(user.id, { name });
        refreshBarbers();
        setRemoteSession((prev) => (prev ? { ...prev, name } : prev));
        return true;
      }

      if (!localSession) return false;
      await updateBarber(localSession.barberId, { name });
      refreshBarbers();
      persistLocal({ ...localSession, name });
      return true;
    },
    [localSession, persistLocal, refreshBarbers],
  );

  const value = useMemo<AuthContextValue>(
    () => ({ session, ready, signIn, register, signOut, refresh, updateName }),
    [session, ready, signIn, register, signOut, refresh, updateName],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
