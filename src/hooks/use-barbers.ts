import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  createBarber,
  deleteBarber,
  getActiveBarbers,
  updateBarber,
  type BarberInput,
} from "@/api/local";
import { syncEngine } from "@/sync/engine";
import type { Barber } from "@/models/types";

export const barbersKey = ["barbers"] as const;

export function useBarbers() {
  return useQuery<Barber[]>({
    queryKey: barbersKey,
    queryFn: getActiveBarbers,
  });
}

export function useCreateBarber() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: BarberInput) => createBarber(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: barbersKey });
      syncEngine.schedule();
    },
  });
}

export function useDeleteBarber() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteBarber(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: barbersKey });
      syncEngine.schedule();
    },
  });
}

export function useUpdateBarber() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<Pick<Barber, "name" | "phone" | "breakMinutes">>;
    }) => updateBarber(id, patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: barbersKey });
      syncEngine.schedule();
    },
  });
}
