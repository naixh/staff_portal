/**
 * Salon-wide settings (currently the configurable payment methods).
 *
 * Settings live in the shared `settings` table on Supabase and are cached in the
 * local Dexie `meta` table so the app keeps working offline.
 */
import { db } from "@/db/dexie";
import { getSupabase, isSupabaseConfigured } from "@/supabase";
import type { Department, PaymentMethodOption } from "@/models/types";

const PAYMENT_METHODS_KEY = "settings:payment_methods";
const PAYMENT_METHODS_ROW = "payment_methods";

/** Used until the salon configures its own list. */
export const DEFAULT_PAYMENT_METHODS: PaymentMethodOption[] = [
  { id: "cash", label: "Cash" },
  { id: "transfer", label: "Transfer" },
];

function normalizeMethods(raw: unknown): PaymentMethodOption[] {
  if (!Array.isArray(raw)) return [];
  const methods: PaymentMethodOption[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const id = String((item as { id?: unknown }).id ?? "").trim();
    const label = String((item as { label?: unknown }).label ?? "").trim();
    if (id && label) methods.push({ id, label });
  }
  return methods;
}

/** The locally cached list (falls back to the defaults). */
export async function readPaymentMethods(): Promise<PaymentMethodOption[]> {
  const record = await db.meta.get(PAYMENT_METHODS_KEY);
  const cached = normalizeMethods(record?.value);
  return cached.length > 0 ? cached : DEFAULT_PAYMENT_METHODS;
}

async function writeLocal(methods: PaymentMethodOption[]): Promise<void> {
  await db.meta.put({ key: PAYMENT_METHODS_KEY, value: methods });
}

/** Read from Supabase (when online) and cache; otherwise use the cache. */
export async function pullPaymentMethods(): Promise<PaymentMethodOption[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await getSupabase()
        .from("settings")
        .select("value")
        .eq("key", PAYMENT_METHODS_ROW)
        .maybeSingle();
      if (!error && data?.value) {
        const methods = normalizeMethods(
          (data.value as { methods?: unknown }).methods,
        );
        if (methods.length > 0) {
          await writeLocal(methods);
          return methods;
        }
      }
    } catch {
      // Offline — fall back to the cache below.
    }
  }
  return readPaymentMethods();
}

/** Persist the list (Supabase + local cache). */
export async function savePaymentMethods(
  methods: PaymentMethodOption[],
): Promise<void> {
  await writeLocal(methods);
  if (!isSupabaseConfigured) return;
  const { error } = await getSupabase()
    .from("settings")
    .upsert(
      { key: PAYMENT_METHODS_ROW, value: { methods } },
      { onConflict: "key" },
    );
  if (error) throw new Error(error.message);
}

// ──────────────────────────────────────────────────────────────────────
// Departments (configurable staff groups)
// ──────────────────────────────────────────────────────────────────────

const DEPARTMENTS_KEY = "settings:departments";
const DEPARTMENTS_ROW = "departments";

/** Matches the original fixed behaviour until an admin edits the list. */
export const DEFAULT_DEPARTMENTS: Department[] = [
  { id: "salon", label: "Salon staff", salonTools: true },
  { id: "other", label: "Other staff", salonTools: false },
];

function normalizeDepartments(raw: unknown): Department[] {
  if (!Array.isArray(raw)) return [];
  const list: Department[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const id = String((item as { id?: unknown }).id ?? "").trim();
    const label = String((item as { label?: unknown }).label ?? "").trim();
    if (!id || !label) continue;
    const salonTools = Boolean((item as { salonTools?: unknown }).salonTools);
    list.push({ id, label, salonTools });
  }
  return list;
}

/** The locally cached department list (falls back to the defaults). */
export async function readDepartments(): Promise<Department[]> {
  const record = await db.meta.get(DEPARTMENTS_KEY);
  const cached = normalizeDepartments(record?.value);
  return cached.length > 0 ? cached : DEFAULT_DEPARTMENTS;
}

async function writeLocalDepartments(list: Department[]): Promise<void> {
  await db.meta.put({ key: DEPARTMENTS_KEY, value: list });
}

/** Read departments from Supabase (when online) and cache; else use the cache. */
export async function pullDepartments(): Promise<Department[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await getSupabase()
        .from("settings")
        .select("value")
        .eq("key", DEPARTMENTS_ROW)
        .maybeSingle();
      if (!error && data?.value) {
        const list = normalizeDepartments(
          (data.value as { departments?: unknown }).departments,
        );
        if (list.length > 0) {
          await writeLocalDepartments(list);
          return list;
        }
      }
    } catch {
      // Offline — fall back to the cache below.
    }
  }
  return readDepartments();
}

/** Persist the department list (Supabase + local cache). */
export async function saveDepartments(list: Department[]): Promise<void> {
  await writeLocalDepartments(list);
  if (!isSupabaseConfigured) return;
  const { error } = await getSupabase()
    .from("settings")
    .upsert(
      { key: DEPARTMENTS_ROW, value: { departments: list } },
      { onConflict: "key" },
    );
  if (error) throw new Error(error.message);
}
