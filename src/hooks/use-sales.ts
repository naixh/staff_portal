import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { createSale, deleteSale, listSales, updateSale } from "@/api/local";
import { syncEngine } from "@/sync/engine";
import type { Sale } from "@/models/types";

export const salesKey = ["sales"] as const;

export function useSales() {
  return useQuery<Sale[]>({
    queryKey: salesKey,
    queryFn: listSales,
  });
}

export type NewSaleInput = Omit<
  Sale,
  "id" | "deleted" | "updatedAt" | "createdAt"
>;

export function useCreateSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NewSaleInput) => createSale(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: salesKey });
      syncEngine.schedule();
    },
  });
}

export function useDeleteSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSale(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: salesKey });
      syncEngine.schedule();
    },
  });
}

/** Correct a recorded sale (keeps the previous values for review). */
export type SalePatch = Partial<
  Pick<Sale, "items" | "total" | "tips" | "paymentMethod">
>;

export function useUpdateSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: SalePatch }) =>
      updateSale(id, patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: salesKey });
      syncEngine.schedule();
    },
  });
}
