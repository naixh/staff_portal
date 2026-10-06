import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DEFAULT_DEPARTMENTS, pullDepartments, saveDepartments } from "@/settings";
import { canManageTeam, type Session } from "@/hooks/use-auth";
import type { Department } from "@/models/types";

export const departmentsKey = ["departments"] as const;

/** The salon's configurable staff departments. */
export function useDepartments(): Department[] {
  const { data } = useQuery({
    queryKey: departmentsKey,
    queryFn: pullDepartments,
    placeholderData: DEFAULT_DEPARTMENTS,
  });
  return data ?? DEFAULT_DEPARTMENTS;
}

export function useUpdateDepartments() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (list: Department[]) => saveDepartments(list),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: departmentsKey });
    },
  });
}

/** Whether a department id gets the salon sales tools. Unknown ids default to no. */
export function departmentHasSalonTools(
  departments: Department[],
  id: string | null | undefined,
): boolean {
  if (!id) return false;
  return departments.find((department) => department.id === id)?.salonTools === true;
}

/** Human label for a department id (falls back to the raw id). */
export function departmentLabel(
  departments: Department[],
  id: string | null | undefined,
): string {
  if (!id) return "—";
  return departments.find((department) => department.id === id)?.label ?? id;
}

/** Owners/admins always have access; everyone else depends on their department. */
export function canUseSalonTools(
  session: Session | null | undefined,
  departments: Department[],
): boolean {
  if (!session) return false;
  if (canManageTeam(session.role)) return true;
  return departmentHasSalonTools(departments, session.department);
}
