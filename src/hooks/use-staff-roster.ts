import { canManageTeam, useAuth } from "@/hooks/use-auth";
import { useBarbers } from "@/hooks/use-barbers";
import { useProfiles } from "@/hooks/use-profiles";
import type { StaffType } from "@/models/types";

export interface RosterMember {
  id: string;
  name: string;
  /** Phone / sign-in number, when known. */
  phone?: string | null;
  /** Configured department id (shared roster only). */
  department?: StaffType;
  /** Daily break allowance in minutes; null/undefined when not set. */
  breakMinutes?: number | null;
  approved: boolean;
  /** Where the member came from — the shared accounts or the local roster. */
  source: "account" | "local";
}

/**
 * The staff roster used by the Attendance and Staff pages.
 *
 * The local `barbers` records live under the signed-in user's own id (they sync
 * per account), so an owner/admin would only ever see themselves. Admins
 * therefore read every account from the shared `profiles` table; everyone else
 * falls back to the local roster.
 */
export function useStaffRoster(): {
  members: RosterMember[];
  isLoading: boolean;
} {
  const { session } = useAuth();
  const admin = canManageTeam(session?.role);
  const profiles = useProfiles();
  const barbers = useBarbers();

  if (admin) {
    const members: RosterMember[] = (profiles.data ?? []).map((profile) => ({
      id: profile.id,
      name: profile.name || profile.phone || profile.id,
      phone: profile.phone,
      department: profile.department,
      breakMinutes: profile.breakMinutes,
      approved: profile.approved,
      source: "account",
    }));
    return { members, isLoading: profiles.isLoading };
  }

  const members: RosterMember[] = (barbers.data ?? []).map((barber) => ({
    id: barber.id,
    name: barber.name,
    phone: barber.phone,
    breakMinutes: barber.breakMinutes ?? null,
    approved: true,
    source: "local",
  }));
  return { members, isLoading: barbers.isLoading };
}
