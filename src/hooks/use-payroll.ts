import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabase } from "@/supabase";
import type { PayrollPayment, PayrollStatus } from "@/models/types";

export const payrollKey = ["payroll"] as const;

/** Column names as they arrive from PostgREST (snake_case). */
interface PayrollRow {
  id: string;
  staff_id: string;
  period: string;
  salary: number | string | null;
  food: number | string | null;
  bonus: number | string | null;
  deductions: number | string | null;
  total: number | string | null;
  note: string | null;
  status: PayrollStatus;
  staff_signature: string | null;
  staff_signed_at: string | null;
  admin_signature: string | null;
  admin_signed_at: string | null;
  created_at: string;
  updated_at: string;
}

function num(value: number | string | null): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toPayment(row: PayrollRow): PayrollPayment {
  return {
    id: row.id,
    staffId: row.staff_id,
    period: row.period,
    salary: num(row.salary),
    food: num(row.food),
    bonus: num(row.bonus),
    deductions: num(row.deductions),
    total: num(row.total),
    note: row.note,
    status: row.status === "signed" ? "signed" : "pending",
    staffSignature: row.staff_signature,
    staffSignedAt: row.staff_signed_at,
    adminSignature: row.admin_signature,
    adminSignedAt: row.admin_signed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Payroll payments. Row Level Security means an admin sees everyone's salary
 * runs while a staff member only sees their own.
 */
export function usePayrollPayments() {
  return useQuery<PayrollPayment[]>({
    queryKey: payrollKey,
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from("payroll_payments")
        .select("*")
        .order("period", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => toPayment(row as PayrollRow));
    },
  });
}

export interface CreatePayrollInput {
  staffId: string;
  period: string;
  salary: number;
  food: number;
  bonus: number;
  deductions: number;
  note?: string;
  adminSignature: string | null;
}

export function useCreatePayroll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreatePayrollInput) => {
      const { error } = await getSupabase()
        .from("payroll_payments")
        .insert({
          staff_id: input.staffId,
          period: input.period,
          salary: input.salary,
          food: input.food,
          bonus: input.bonus,
          deductions: input.deductions,
          note: input.note?.trim() || null,
          admin_signature: input.adminSignature,
          admin_signed_at: input.adminSignature ? new Date().toISOString() : null,
        });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: payrollKey });
    },
  });
}

export function useDeletePayroll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await getSupabase()
        .from("payroll_payments")
        .delete()
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: payrollKey });
    },
  });
}

/** Staff acknowledge receipt by signing — handled server-side for safety. */
export function useSignPayroll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      signature,
    }: {
      id: string;
      signature: string;
    }) => {
      const { error } = await getSupabase().rpc("sign_payroll", {
        payment: id,
        signature,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: payrollKey });
    },
  });
}
