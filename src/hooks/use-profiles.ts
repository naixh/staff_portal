import { useQuery } from "@tanstack/react-query";
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
  created_at: string;
}

export const profilesKey = ["profiles"] as const;

export const PROFILE_COLUMNS =
  "id,name,phone,role,department,approved,salary,food,bonus,created_at";

function num(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toProfile(row: Record<string, unknown>): Profile {
  const role = row.role;
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
    created_at: String(row.created_at ?? ""),
  };
}

/** All accounts (owners/admins see everyone; a staff member only themselves). */
export function useProfiles() {
  return useQuery<Profile[]>({
    queryKey: profilesKey,
    queryFn: async () => {
      const supabase = getSupabase();
      const full = await supabase
        .from("profiles")
        .select(PROFILE_COLUMNS)
        .order("created_at", { ascending: true });
      if (!full.error) {
        return (full.data ?? []).map((row) =>
          toProfile(row as Record<string, unknown>),
        );
      }

      // Older schema without the payroll columns (migration 0007 pending).
      const legacy = await supabase
        .from("profiles")
        .select("id,name,phone,role,approved,created_at")
        .order("created_at", { ascending: true });
      if (legacy.error) throw new Error(legacy.error.message);
      return (legacy.data ?? []).map((row) =>
        toProfile(row as Record<string, unknown>),
      );
    },
  });
}
