import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabase } from "@/supabase";
import type { StaffType } from "@/models/types";
import type { Role } from "@/hooks/use-auth";

export interface Profile {
  id: string;
  name: string | null;
  phone: string | null;
  role: Role;
  department: StaffType;
  approved: boolean;
  salary: number;
  food: number;
  bonus: number;
  /** Allowed break time per day, in minutes (null = not set). */
  breakMinutes: number | null;
  created_at: string;
}

export const profilesKey = ["profiles"] as const;

const FULL_COLUMNS =
  "id,name,phone,role,department,approved,salary,food,bonus,break_minutes,created_at";
// Older schemas (before 0009 / 0007) — tried in order so a missing column on one
// environment can't blank out the whole list.
const NO_BREAK_COLUMNS =
  "id,name,phone,role,department,approved,salary,food,bonus,created_at";
const LEGACY_COLUMNS = "id,name,phone,role,approved,created_at";

function num(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toProfile(row: Record<string, unknown>): Profile {
  const role = row.role;
  const breakMinutes = row.break_minutes;
  return {
    id: String(row.id),
    name: (row.name as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    role: role === "owner" ? "owner" : role === "admin" ? "admin" : "staff",
    department:
      typeof row.department === "string" && row.department
        ? row.department
        : "salon",
    approved: Boolean(row.approved),
    salary: num(row.salary),
    food: num(row.food),
    bonus: num(row.bonus),
    breakMinutes:
      breakMinutes === null || breakMinutes === undefined
        ? null
        : Number(breakMinutes),
    created_at: String(row.created_at ?? ""),
  };
}

async function fetchProfiles(): Promise<Profile[]> {
  const supabase = getSupabase();
  for (const columns of [FULL_COLUMNS, NO_BREAK_COLUMNS, LEGACY_COLUMNS]) {
    const { data, error } = await supabase
      .from("profiles")
      .select(columns)
      .order("created_at", { ascending: true });
    if (!error) {
      return (data ?? []).map((row) =>
        toProfile(row as unknown as Record<string, unknown>),
      );
    }
  }
  throw new Error("Could not load staff accounts");
}

/** All accounts (owners/admins see everyone; a staff member only themselves). */
export function useProfiles() {
  return useQuery<Profile[]>({
    queryKey: profilesKey,
    queryFn: fetchProfiles,
  });
}

/** Update a staff profile (admins only, enforced by RLS). */
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: Record<string, unknown>;
    }) => {
      const { error } = await getSupabase()
        .from("profiles")
        .update(patch)
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: profilesKey });
    },
  });
}
