import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ShieldCheck, Wallet } from "lucide-react";
import { ClockCard } from "@/components/clock-card";
import { Money } from "@/components/money";
import { useAuth } from "@/hooks/use-auth";
import { usePayrollPayments } from "@/hooks/use-payroll";
import { useProfiles } from "@/hooks/use-profiles";
import { getSupabase } from "@/supabase";

function greeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/**
 * A deliberately simple home screen for staff who don't work the shop floor
 * (cleaners, guards, office help…). They can clock in/out, see their salary and
 * their employment work permit — nothing from the salon sales side.
 */
export function StaffHome() {
  const { session } = useAuth();
  const { data: profiles = [] } = useProfiles();
  const { data: payments = [] } = usePayrollPayments();
  const [showPermit, setShowPermit] = useState(false);

  const me = profiles.find((profile) => profile.id === session?.userId);
  const outstanding = payments.filter((payment) => payment.status !== "signed");

  const permitQuery = useQuery({
    queryKey: ["my-permit", session?.userId] as const,
    enabled: Boolean(session?.userId),
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from("profiles")
        .select("work_permit,work_permit_name")
        .eq("id", session?.userId ?? "")
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data ?? null) as
        | { work_permit: string | null; work_permit_name: string | null }
        | null;
    },
  });
  const permit = permitQuery.data?.work_permit ?? null;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border bg-gradient-to-br from-white to-teal-50 p-5 shadow-card">
        <p className="text-sm text-slate-500">{greeting(new Date().getHours())}</p>
        <h2 className="mt-1 text-2xl font-bold">
          Welcome, {session?.name ?? "there"} 👋
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Clock in for your shift and check your salary here.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ClockCard showHistory />

        <div className="rounded-xl border bg-white p-5 shadow-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-full bg-slate-100">
                <Wallet className="size-4" />
              </div>
              <div>
                <div className="font-semibold">My salary</div>
                <div className="text-xs text-slate-500">
                  Salary, food allowance and bonus
                </div>
              </div>
            </div>
            <Link to="/payroll" className="text-sm font-medium">
              View
            </Link>
          </div>
          {me && (
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-slate-50 p-2">
                <div className="text-[10px] uppercase tracking-wide text-slate-400">
                  Salary
                </div>
                <div className="mt-1 text-sm font-semibold">
                  <Money value={me.salary} />
                </div>
              </div>
              <div className="rounded-lg bg-slate-50 p-2">
                <div className="text-[10px] uppercase tracking-wide text-slate-400">
                  Food
                </div>
                <div className="mt-1 text-sm font-semibold">
                  <Money value={me.food} />
                </div>
              </div>
              <div className="rounded-lg bg-slate-50 p-2">
                <div className="text-[10px] uppercase tracking-wide text-slate-400">
                  Bonus
                </div>
                <div className="mt-1 text-sm font-semibold">
                  <Money value={me.bonus} />
                </div>
              </div>
            </div>
          )}
          {outstanding.length > 0 && (
            <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {outstanding.length} payslip{outstanding.length > 1 ? "s" : ""} awaiting
              your signature.
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border bg-white p-5 shadow-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-full bg-slate-100">
              <ShieldCheck className="size-4" />
            </div>
            <div>
              <div className="font-semibold">Work permit</div>
              <div className="text-xs text-slate-500">
                Your employment permit on file
              </div>
            </div>
          </div>
          {permit && (
            <button
              type="button"
              onClick={() => setShowPermit((value) => !value)}
              className="text-sm font-medium"
            >
              {showPermit ? "Hide" : "View"}
            </button>
          )}
        </div>
        {permit ? (
          showPermit ? (
            <img
              src={permit}
              alt="Employment work permit"
              className="mt-4 max-h-96 w-full rounded-lg border object-contain"
            />
          ) : (
            <img
              src={permit}
              alt="Employment work permit"
              className="mt-4 h-20 w-28 rounded-lg border object-cover"
            />
          )
        ) : (
          <p className="mt-3 text-sm text-slate-500">
            No permit uploaded yet — an admin can add it from the Team page.
          </p>
        )}
      </div>
    </div>
  );
}
