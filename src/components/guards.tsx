import type { ReactNode } from "react";
import { Navigate } from "@tanstack/react-router";
import { canManageTeam, useAuth } from "@/hooks/use-auth";
import { canUseSalonTools, useDepartments } from "@/hooks/use-departments";

/** Only salon staff, admins and the owner may see the register/sales screens. */
export function SalonOnly({ children }: { children: ReactNode }) {
  const { session, ready } = useAuth();
  const departments = useDepartments();
  if (!ready) return null;
  if (!canUseSalonTools(session, departments)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

/** Only owners and admins may see the Team / settings screens. */
export function AdminOnly({ children }: { children: ReactNode }) {
  const { session, ready } = useAuth();
  if (!ready) return null;
  if (!canManageTeam(session?.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
