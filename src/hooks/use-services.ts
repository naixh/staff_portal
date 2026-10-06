import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  createService,
  deleteService,
  getActiveServices,
  updateService,
} from "@/api/local";
import { syncEngine } from "@/sync/engine";
import type { Service } from "@/models/types";

export const servicesKey = ["services"] as const;

export function useServices() {
  return useQuery<Service[]>({
    queryKey: servicesKey,
    queryFn: getActiveServices,
  });
}

export function useCreateService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      name: string;
      price: number;
      priceUsd?: number;
      category?: string;
    }) => createService(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: servicesKey });
      syncEngine.schedule();
    },
  });
}

export function useUpdateService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<Pick<Service, "name" | "price" | "category" | "priceUsd">>;
    }) => updateService(id, patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: servicesKey });
      syncEngine.schedule();
    },
  });
}

export function useDeleteService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteService(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: servicesKey });
      syncEngine.schedule();
    },
  });
}
