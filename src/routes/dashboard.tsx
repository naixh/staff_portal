import { useMemo, type ComponentType, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { isToday, parseISO } from "date-fns";
import {
  BadgeDollarSign,
  CircleDollarSign,
  Clock3,
  Coffee,
  Hourglass,
  Receipt,
  Scissors,
  Thermometer,
  Users,
} from "lucide-react";
import { Money } from "@/components/money";
import { ClockCard } from "@/components/clock-card";
import { COMPANY_NAME } from "@/brand";
import { StaffHome } from "@/components/staff-home";
import { useSales } from "@/hooks/use-sales";
import { useBarbers } from "@/hooks/use-barbers";
import { canUseSalonTools, useDepartments } from "@/hooks/use-departments";
import { canManageTeam, useAuth } from "@/hooks/use-auth";
import { useMyClock } from "@/hooks/use-my-clock";
import { todayKey, useAttendance } from "@/hooks/use-attendance";
import type { Attendance, Sale } from "@/models/types";
import { formatTime, initial, minutesBetween } from "@/utils/format";
import { paymentBadgeClass, paymentLabel } from "@/utils/ui";
import { usePaymentMethods } from "@/hooks/use-payment-methods";

function greeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function saleLabel(sale: Sale): string {
  return sale.items.map((item) => item.serviceName).join(" + ") || "Sale";
}

/** Minutes taken on break, or null when unknown. */
function breakTaken(record: Attendance | undefined): number | null {
  return minutesBetween(record?.breakStart, record?.breakEnd);
}

export function DashboardRoute() {
  const { session } = useAuth();
  const departments = useDepartments();
  // Staff who don't work the shop floor get a stripped-back home screen.
  if (session && !canUseSalonTools(session, departments)) {
    return <StaffHome />;
  }
  return <SalonDashboard />;
}

function SalonDashboard() {
  const { session } = useAuth();
  const isAdmin = canManageTeam(session?.role);
  const { data: sales = [] } = useSales();
  const { data: barbers = [] } = useBarbers();
  const methods = usePaymentMethods();
  const { data: attendance = [] } = useAttendance();
  const myClock = useMyClock();
  const today = todayKey();
  const todayAttendance = new Map<string, Attendance>(
    attendance
      .filter((record) => record.date === today)
      .map((record) => [record.barberId, record] as const),
  );

  // Admins see the whole salon; floor staff only see the sales they took.
  const todaySales = useMemo(
    () =>
      sales.filter(
        (s) =>
          isToday(parseISO(s.soldAt)) &&
          (isAdmin || s.barberId === session?.barberId),
      ),
    [sales, isAdmin, session?.barberId],
  );

  const todaysTotal = todaySales
    .filter((s) => (s.currency ?? "MVR") === "MVR")
    .reduce((sum, s) => sum + s.total, 0);
  const usdTotal = todaySales
    .filter((s) => s.currency === "USD")
    .reduce((sum, s) => sum + s.total, 0);
  const todaysTips = todaySales
    .filter((s) => (s.currency ?? "MVR") === "MVR")
    .reduce((sum, s) => sum + (s.tips ?? 0), 0);
  const usdTips = todaySales
    .filter((s) => s.currency === "USD")
    .reduce((sum, s) => sum + (s.tips ?? 0), 0);
  /** Only surface the USD figures when there actually are USD transactions. */
  const hasUsdSales = todaySales.some((s) => s.currency === "USD");
  const tippedCount = todaySales.filter((s) => (s.tips ?? 0) > 0).length;
  const count = todaySales.length;
  const cashCount = todaySales.filter((s) => s.paymentMethod === "cash").length;

  const barbersIn = barbers.filter((barber) => {
    const record = todayAttendance.get(barber.id);
    return Boolean(record?.clockIn) && !record?.clockOut;
  }).length;

  const onLeave = barbers.filter(
    (barber) => todayAttendance.get(barber.id)?.status === "leave",
  );
  const onSick = barbers.filter(
    (barber) => todayAttendance.get(barber.id)?.status === "sick",
  );
  const awayCount = onLeave.length + onSick.length;
  const notCheckedIn = Math.max(0, barbers.length - barbersIn - awayCount);

  const recent = todaySales.slice(0, 4);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border bg-gradient-to-br from-white to-amber-50 p-5 shadow-card">
        <p className="text-sm text-slate-500">
          {greeting(new Date().getHours())}
        </p>
        <h2 className="mt-1 text-2xl font-bold">
          {isAdmin
            ? COMPANY_NAME
            : `Welcome back, ${session?.name ?? "there"} 👋`}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {isAdmin
            ? "Here is today's overview — sales, attendance and leave."
            : "Here is today's salon performance."}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {!isAdmin && (
            <>
              <button
                type="button"
                onClick={() => myClock.act(myClock.checkedIn ? "out" : "in")}
                disabled={!myClock.session || myClock.pending}
                className="flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40"
              >
                <Clock3 className="size-4" /> {myClock.primaryLabel}
              </button>
              {myClock.checkedIn && (
                <button
                  type="button"
                  onClick={() =>
                    myClock.act(myClock.onBreak ? "break-end" : "break-start")
                  }
                  disabled={myClock.pending}
                  className="flex items-center gap-2 rounded-lg border bg-white px-4 py-2.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-40"
                >
                  <Coffee className="size-4" />
                  {myClock.onBreak ? "End Break" : "Start Break"}
                </button>
              )}
              {!myClock.checkedIn && !myClock.finished && (
                <button
                  type="button"
                  onClick={() =>
                    myClock.markLeave(myClock.leaveStatus === "sick" ? null : "sick")
                  }
                  disabled={myClock.pending}
                  className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium disabled:opacity-40 ${
                    myClock.leaveStatus === "sick"
                      ? "border-amber-300 bg-amber-50 text-amber-800"
                      : "bg-white hover:bg-slate-50"
                  }`}
                >
                  <Thermometer className="size-4" />
                  {myClock.leaveStatus === "sick" ? "Sick today" : "Mark sick"}
                </button>
              )}
            </>
          )}
          {isAdmin && (
            <Link
              to="/attendance"
              className="flex items-center gap-2 rounded-lg border bg-white px-4 py-2.5 text-sm font-medium"
            >
              <Clock3 className="size-4" /> Attendance
            </Link>
          )}
          {isAdmin && (
            <Link
              to="/admin"
              className="flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white"
            >
              <Users className="size-4" /> Team
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label={isAdmin ? "Today's Sales" : "My sales"}
          value={
            <>
              <Money value={todaysTotal} />
              {hasUsdSales && (
                <span className="ml-2 text-base font-semibold text-slate-500">
                  <Money value={usdTotal} currency="USD" />
                </span>
              )}
            </>
          }
          hint={`${count} transactions today`}
          icon={CircleDollarSign}
        />
        <StatCard
          label="Transactions"
          value={String(count)}
          hint={`${cashCount} cash · ${count - cashCount} other`}
          icon={Receipt}
        />
        <StatCard
          label="Tips"
          value={
            <>
              <Money value={todaysTips} />
              {usdTips > 0 && (
                <span className="ml-2 text-base font-semibold text-slate-500">
                  <Money value={usdTips} currency="USD" />
                </span>
              )}
            </>
          }
          hint={`Across ${tippedCount} transactions`}
          icon={BadgeDollarSign}
        />
        <StatCard
          label={isAdmin ? "Staff in" : "Barbers In"}
          value={`${barbersIn} / ${barbers.length}`}
          hint={
            notCheckedIn === 0
              ? "Everyone accounted for"
              : `${notCheckedIn} not checked in`
          }
          icon={Users}
        />
        <StatCard
          label="On leave / sick"
          value={String(awayCount)}
          hint={
            awayCount === 0
              ? "Everyone available"
              : `${onLeave.length} leave · ${onSick.length} sick`
          }
          icon={Hourglass}
        />
      </div>

      {!isAdmin && <ClockCard showHistory />}

      <div className="grid gap-4 xl:grid-cols-[1.3fr_.7fr]">
        <div className="rounded-xl border bg-white shadow-card">
          <div className="flex items-center justify-between border-b p-4">
            <div>
              <h3 className="font-semibold">
                {isAdmin ? "Recent sales" : "My recent sales"}
              </h3>
              <p className="text-xs text-slate-500">
                {isAdmin ? "Latest transactions today" : "Your latest sales today"}
              </p>
            </div>
            <Link to="/sales" className="text-sm font-medium">
              View all
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">
              {isAdmin
                ? "No sales recorded today yet."
                : "You haven't recorded any sales today."}
            </p>
          ) : (
            <div className="divide-y">
              {recent.map((sale) => (
                <div key={sale.id} className="flex items-center gap-3 p-4">
                  <div className="grid size-10 place-items-center rounded-full bg-slate-100">
                    <Scissors className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="break-words text-sm font-medium">
                      {saleLabel(sale)}
                    </div>
                    <div className="text-xs text-slate-500">
                      {sale.barberName} · {formatTime(sale.soldAt)}
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2 py-1 text-xs ${paymentBadgeClass(methods, sale.paymentMethod)}`}
                  >
                    {paymentLabel(methods, sale.paymentMethod)}
                  </span>
                  <div className="text-sm font-semibold">
                    <Money value={sale.total} currency={sale.currency} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border bg-white p-4 shadow-card">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">{isAdmin ? "Staff status" : "Barber status"}</h3>
              <p className="text-xs text-slate-500">Today&apos;s attendance</p>
            </div>
            <Link to="/attendance" className="text-sm font-medium">
              Manage
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {barbers.length === 0 ? (
              <p className="text-sm text-slate-500">
                No barbers yet. Add staff from the{" "}
                <Link to="/barbers" className="font-medium underline">
                  Barber Time
                </Link>{" "}
                page.
              </p>
            ) : (
              barbers.map((barber) => {
                const record = todayAttendance.get(barber.id);
                const isIn = Boolean(record?.clockIn) && !record?.clockOut;
                const isDone = Boolean(record?.clockOut);
                const breakMins = breakTaken(record);
                const away = record?.status;
                const badge =
                  away === "leave"
                    ? "Leave"
                    : away === "sick"
                      ? "Sick"
                      : isIn
                        ? "In"
                        : isDone
                          ? "Done"
                          : "Out";
                const badgeClass = away
                  ? "bg-amber-100 text-amber-700"
                  : isIn || isDone
                    ? "status-in"
                    : "status-out";
                const detail =
                  away === "leave"
                    ? "On leave today"
                    : away === "sick"
                      ? "Sick today"
                      : record?.clockIn
                        ? `In ${record.clockIn}${isIn ? "" : ` · Out ${record.clockOut}`}${
                            breakMins !== null ? ` · break ${breakMins}m` : ""
                          }`
                        : "Not checked in";
                return (
                  <div
                    key={barber.id}
                    className="flex items-center gap-3 rounded-lg border p-3"
                  >
                    <div className="grid size-9 place-items-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                      {initial(barber.name)}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium">{barber.name}</div>
                      <div className="text-xs text-slate-500">{detail}</div>
                    </div>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${badgeClass}`}
                    >
                      {badge}
                    </span>
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

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: ReactNode;
  hint: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-card">
      <div className="flex justify-between">
        <span className="text-sm text-slate-500">{label}</span>
        <Icon className="size-4 text-slate-400" />
      </div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{hint}</div>
    </div>
  );
}
