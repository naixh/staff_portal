import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Clock3 } from "lucide-react";
import { useMyClock } from "@/hooks/use-my-clock";
import type { Attendance } from "@/models/types";
import { formatDuration, initial, timeToMinutes } from "@/utils/format";

/**
 * Minutes since clock-in — measured against clock-out, or against `now` while
 * the shift is still running — minus any break time taken so far.
 */
function runningMinutes(
  record: Attendance | undefined,
  now: Date,
): number | null {
  if (!record?.clockIn) return null;
  const start = timeToMinutes(record.clockIn);
  if (start === null) return null;

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const endMinutes = record.clockOut
    ? timeToMinutes(record.clockOut)
    : nowMinutes;
  if (endMinutes === null) return null;

  const span = Math.max(0, endMinutes - start);
  const breakStart = timeToMinutes(record.breakStart);
  const breakEnd = record.breakEnd
    ? timeToMinutes(record.breakEnd)
    : record.breakStart
      ? nowMinutes
      : null;
  const breakMins =
    breakStart !== null && breakEnd !== null
      ? Math.max(0, breakEnd - breakStart)
      : 0;

  return Math.max(0, span - breakMins);
}

/**
 * Clock in / out and break controls for the signed-in staff member, used on both
 * the staff home screen and the salon dashboard.
 */
export function ClockCard({ showHistory = false }: { showHistory?: boolean }) {
  const { session, record, checkedIn, finished, onBreak, act, pending, primaryLabel } =
    useMyClock();
  const away = record?.status;

  const statusText =
    away === "leave"
      ? "On leave today"
      : away === "sick"
        ? "Marked sick today"
        : onBreak
          ? `On break since ${record?.breakStart}`
          : finished
            ? `Completed · ${record?.clockIn ?? "—"}–${record?.clockOut}`
            : checkedIn
              ? `Checked in at ${record?.clockIn}`
              : "Not checked in";

  // Tick while the shift is running so the worked time stays live.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!checkedIn) return;
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, [checkedIn]);
  const worked = runningMinutes(record, now);

  return (
    <div className="rounded-xl border bg-white p-5 shadow-card">
      <div className="flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-full bg-slate-950 text-sm font-semibold text-white">
          {initial(session?.name ?? "?")}
        </div>
        <div className="min-w-0">
          <div className="font-semibold">Today&apos;s attendance</div>
          <div className="text-xs text-slate-500">{statusText}</div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
        <span>Break: {record?.breakStart ?? "—"}</span>
        <span>
          {checkedIn ? "Running" : "Worked"}:{" "}
          <span className="font-medium text-slate-700">
            {formatDuration(worked)}
          </span>
        </span>
      </div>

      <div className="mt-4 space-y-2">
        <button
          type="button"
          onClick={() => act(checkedIn ? "out" : "in")}
          disabled={!session || pending}
          className="w-full rounded-lg bg-slate-950 px-4 py-3 text-sm font-medium text-white disabled:opacity-40"
        >
          {primaryLabel}
        </button>
        {checkedIn && (
          <button
            type="button"
            onClick={() => act(onBreak ? "break-end" : "break-start")}
            disabled={pending}
            className="w-full rounded-lg border px-4 py-3 text-sm font-medium hover:bg-slate-50 disabled:opacity-40"
          >
            {onBreak ? "End Break" : "Start Break"}
          </button>
        )}
        {showHistory && (
          <Link
            to="/attendance"
            className="flex items-center justify-center gap-2 text-xs font-medium text-slate-500 hover:text-slate-800"
          >
            <Clock3 className="size-3.5" /> History & team attendance
          </Link>
        )}
      </div>
    </div>
  );
}
