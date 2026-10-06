import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listAttendance, localDateKey, recordClock, setLeaveStatus } from "@/api/local";
import type { ClockAction } from "@/api/local";
import { syncEngine } from "@/sync/engine";
import type { Attendance, LeaveStatus } from "@/models/types";

export const attendanceKey = ["attendance"] as const;

/** All synced attendance records. */
export function useAttendance() {
  return useQuery<Attendance[]>({
    queryKey: attendanceKey,
    queryFn: listAttendance,
  });
}

/** Clock a barber in or out for today. */
export function useClock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      barberId,
      barberName,
      action,
    }: {
      barberId: string;
      barberName: string;
      action: ClockAction;
    }) => recordClock(barberId, barberName, action),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: attendanceKey });
      syncEngine.schedule();
    },
  });
}

/** Mark (or clear) a staff member's leave/sick status for today. */
export function useSetLeaveStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      barberId,
      barberName,
      status,
    }: {
      barberId: string;
      barberName: string;
      status: LeaveStatus | null;
    }) => setLeaveStatus(barberId, barberName, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: attendanceKey });
      syncEngine.schedule();
    },
  });
}

/** Today's local date, YYYY-MM-DD. */
export function todayKey(): string {
  return localDateKey();
}
