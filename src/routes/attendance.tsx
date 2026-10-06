import { Link } from "@tanstack/react-router";
import { UserPlus } from "lucide-react";
import type { ClockAction } from "@/api/local";
import { canManageTeam, useAuth, ROLE_LABELS } from "@/hooks/use-auth";
import { canUseSalonTools, useDepartments } from "@/hooks/use-departments";
import { useBarbers } from "@/hooks/use-barbers";
import { todayKey, useAttendance, useClock, useSetLeaveStatus } from "@/hooks/use-attendance";
import type { Attendance, LeaveStatus } from "@/models/types";
import { formatDuration, initial, minutesBetween } from "@/utils/format";

/** Minutes actually taken on break, or null when unknown. */
function breakTaken(record: Attendance | undefined): number | null {
  return minutesBetween(record?.breakStart, record?.breakEnd);
}

/** Worked minutes (out − in − break), or null while the shift is unfinished. */
function workedMinutes(record: Attendance | undefined): number | null {
  const span = minutesBetween(record?.clockIn, record?.clockOut);
  if (span === null) return null;
  return Math.max(0, span - (breakTaken(record) ?? 0));
}

function breakLabel(record: Attendance | undefined): string {
  if (!record?.breakStart) return "—";
  return `${record.breakStart}${record.breakEnd ? `–${record.breakEnd}` : "–…"}`;
}

export function AttendanceRoute() {
  const { session } = useAuth();
  const departments = useDepartments();
  const { data: barbers = [] } = useBarbers();
  const { data: attendance = [] } = useAttendance();
  const clock = useClock();
  const setLeave = useSetLeaveStatus();
  const isAdmin = canManageTeam(session?.role);

  const today = todayKey();
  const byBarber = new Map<string, Attendance>(
    attendance
      .filter((record) => record.date === today)
      .map((record) => [record.barberId, record] as const),
  );

  const myRecord = session ? byBarber.get(session.barberId) : undefined;
  const myLeave = myRecord?.status;
  const checkedIn = Boolean(myRecord?.clockIn) && !myRecord?.clockOut;
  const finished = Boolean(myRecord?.clockOut);
  const onBreak = checkedIn && Boolean(myRecord?.breakStart) && !myRecord?.breakEnd;

  const myAllowance = session
    ? barbers.find((barber) => barber.id === session.barberId)?.breakMinutes
    : undefined;
  const myBreak = breakTaken(myRecord);

  function act(action: ClockAction) {
    if (!session) return;
    clock.mutate({
      barberId: session.barberId,
      barberName: session.name,
      action,
    });
  }

  const rows = barbers.map((barber) => ({
    id: barber.id,
    name: barber.name,
    role: barber.id === session?.barberId ? "You" : "Staff",
  }));
  if (session && !rows.some((row) => row.id === session.barberId)) {
    rows.unshift({ id: session.barberId, name: session.name, role: "You" });
  }

  const statusText =
    myLeave === "leave"
      ? "On leave today"
      : myLeave === "sick"
        ? "Marked sick today"
        : onBreak
          ? `On break since ${myRecord?.breakStart}`
          : finished
            ? `Completed · ${myRecord?.clockIn ?? "—"}–${myRecord?.clockOut}`
            : checkedIn
              ? `Checked in at ${myRecord?.clockIn}`
              : "Not checked in";
  const badgeText = myLeave
    ? myLeave === "leave"
      ? "Leave"
      : "Sick"
    : onBreak
      ? "Break"
      : finished
        ? "Done"
        : checkedIn
          ? "In"
          : "Out";
  const badgeTone = myLeave
    ? "bg-amber-100 text-amber-700"
    : onBreak
      ? "status-break"
      : checkedIn || finished
        ? "status-in"
        : "status-out";
  const primaryLabel = finished
    ? "Clock In Again"
    : checkedIn
      ? "Clock Out"
      : "Clock In";

  const isOtherStaff = session ? !canUseSalonTools(session, departments) : false;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">
          {isAdmin || isOtherStaff ? "Attendance" : "Barber time"}
        </h2>
        <p className="text-sm text-slate-500">
          Clock-in, breaks and clock-out are saved against your account and synced
          across the team.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border bg-white p-5 shadow-card lg:col-span-1">
          <div className="flex items-center gap-3">
            <div className="grid size-12 place-items-center rounded-full bg-slate-950 text-sm font-semibold text-white">
              {initial(session?.name ?? "?")}
            </div>
            <div className="min-w-0">
              <div className="truncate font-semibold">
                {session?.name ?? "Guest"}
              </div>
              <div className="text-sm text-slate-500">
                {session ? ROLE_LABELS[session.role] : ""}
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-lg bg-slate-50 p-4">
            <div className="text-xs text-slate-500">Current status</div>
            <div className="mt-1 flex items-center justify-between">
              <div className="text-xl font-semibold">{statusText}</div>
              <span
                className={`rounded-full px-2 py-1 text-xs font-medium ${badgeTone}`}
              >
                {badgeText}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
              <span>Break: {breakLabel(myRecord)}</span>
              {myAllowance !== undefined && (
                <span
                  className={
                    myBreak !== null && myBreak > myAllowance
                      ? "font-medium text-rose-600"
                      : ""
                  }
                >
                  {myBreak ?? 0} / {myAllowance} min
                </span>
              )}
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
              <span>Worked</span>
              <span className="font-medium text-slate-700">
                {formatDuration(workedMinutes(myRecord))}
              </span>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <button
              type="button"
              onClick={() => act(checkedIn ? "out" : "in")}
              disabled={!session || clock.isPending}
              className="w-full rounded-lg bg-slate-950 px-4 py-3 text-sm font-medium text-white disabled:opacity-40"
            >
              {primaryLabel}
            </button>
            {checkedIn && (
              <button
                type="button"
                onClick={() => act(onBreak ? "break-end" : "break-start")}
                disabled={clock.isPending}
                className="w-full rounded-lg border px-4 py-3 text-sm font-medium hover:bg-slate-50 disabled:opacity-40"
              >
                {onBreak ? "End Break" : "Start Break"}
              </button>
            )}
          </div>
        </div>

        <div className="rounded-xl border bg-white shadow-card lg:col-span-2">
          <div className="flex items-center justify-between border-b p-4">
            <h3 className="font-semibold">Today&apos;s attendance</h3>
            {canManageTeam(session?.role) && (
              <Link
                to="/barbers"
                className="flex items-center gap-1 text-sm font-medium"
              >
                <UserPlus className="size-4" /> Manage staff
              </Link>
            )}
          </div>
          <div className="divide-y">
            {rows.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-500">
                No staff yet. Add barbers to start tracking attendance.
              </p>
            ) : (
              rows.map((row) => {
                const record = byBarber.get(row.id);
                return (
                  <div
                    key={row.id}
                    className={`grid items-center gap-1 p-4 text-sm ${
                      isAdmin
                        ? "grid-cols-[1fr_48px_74px_48px_56px_92px]"
                        : "grid-cols-[1fr_48px_74px_48px_56px]"
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="grid size-9 place-items-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                        {initial(row.name)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium">{row.name}</span>
                          {record?.status && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-700">
                              {record.status}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500">{row.role}</div>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">In</div>
                      <div>{record?.clockIn ?? "—"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Break</div>
                      <div className="truncate text-xs">{breakLabel(record)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Out</div>
                      <div>{record?.clockOut ?? "—"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Hrs</div>
                      <div className="text-xs">
                        {formatDuration(workedMinutes(record))}
                      </div>
                    </div>
                    {isAdmin && (
                      <select
                        value={record?.status ?? ""}
                        onChange={(e) =>
                          setLeave.mutate({
                            barberId: row.id,
                            barberName: row.name,
                            status:
                              e.target.value === ""
                                ? null
                                : (e.target.value as LeaveStatus),
                          })
                        }
                        aria-label={`Attendance status for ${row.name}`}
                        className="h-8 w-full rounded-md border bg-white px-1 text-xs outline-none focus:ring-2 focus:ring-slate-900"
                      >
                        <option value="">Present</option>
                        <option value="leave">Leave</option>
                        <option value="sick">Sick</option>
                      </select>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
