import type { ClockAction } from "@/api/local";
import { useAuth } from "@/hooks/use-auth";
import {
  todayKey,
  useAttendance,
  useClock,
  useSetLeaveStatus,
} from "@/hooks/use-attendance";
import type { Attendance, LeaveStatus } from "@/models/types";

export interface MyClock {
  session: ReturnType<typeof useAuth>["session"];
  /** Today's attendance record for the signed-in user, if any. */
  record: Attendance | undefined;
  checkedIn: boolean;
  finished: boolean;
  onBreak: boolean;
  pending: boolean;
  primaryLabel: string;
  /** Today's leave/sick marking, if any. */
  leaveStatus: LeaveStatus | null;
  /** Clock in / out (or start / end a break). */
  act: (action: ClockAction) => void;
  /** Mark (or clear, with `null`) today's leave/sick status. */
  markLeave: (status: LeaveStatus | null) => void;
}

/** Today's clock state and actions for the signed-in user. */
export function useMyClock(): MyClock {
  const { session } = useAuth();
  const { data: attendance = [] } = useAttendance();
  const clock = useClock();
  const setLeave = useSetLeaveStatus();

  const today = todayKey();
  const record = attendance.find(
    (entry) => entry.date === today && entry.barberId === session?.barberId,
  );
  const checkedIn = Boolean(record?.clockIn) && !record?.clockOut;
  const finished = Boolean(record?.clockOut);
  const onBreak = checkedIn && Boolean(record?.breakStart) && !record?.breakEnd;

  function act(action: ClockAction) {
    if (!session) return;
    clock.mutate({
      barberId: session.barberId,
      barberName: session.name,
      action,
    });
  }

  function markLeave(status: LeaveStatus | null) {
    if (!session) return;
    setLeave.mutate({
      barberId: session.barberId,
      barberName: session.name,
      status,
    });
  }

  return {
    session,
    record,
    checkedIn,
    finished,
    onBreak,
    pending: clock.isPending || setLeave.isPending,
    primaryLabel: finished
      ? "Clock In Again"
      : checkedIn
        ? "Clock Out"
        : "Clock In",
    leaveStatus: record?.status ?? null,
    act,
    markLeave,
  };
}
