import { useEffect, useMemo, useState } from "react";
import { addToast } from "@heroui/react";
import { Eye, EyeOff, PenLine, Plus, Trash2, Wallet } from "lucide-react";
import { Money, RufiyaaSign } from "@/components/money";
import { SignaturePad } from "@/components/signature-pad";
import { canManageTeam, useAuth } from "@/hooks/use-auth";
import { useProfiles } from "@/hooks/use-profiles";
import { useVerifyPin } from "@/hooks/use-verify-pin";
import {
  useCreatePayroll,
  useDeletePayroll,
  usePayrollPayments,
  useSignPayroll,
} from "@/hooks/use-payroll";
import type { Currency, PayrollPayment } from "@/models/types";
import { initial } from "@/utils/format";

/** Current payroll period as YYYY-MM. */
function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** "2026-10" -> "October 2026". */
function periodLabel(period: string): string {
  const [year, month] = period.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  if (Number.isNaN(date.getTime())) return period;
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function signedAtLabel(value: string | null): string {
  if (!value) return "";
  return new Date(value).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PayrollRoute() {
  const { session } = useAuth();
  const admin = canManageTeam(session?.role);
  // Salary figures stay masked until the PIN is re-entered.
  const [revealed, setRevealed] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">
            {admin ? "Payroll" : "My salary"}
          </h2>
          <p className="text-sm text-slate-500">
            {admin
              ? "Run salary for a staff member, sign it off, and they sign back to acknowledge receipt."
              : "Your salary runs appear here — sign to acknowledge each payment you receive."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => (revealed ? setRevealed(false) : setPromptOpen(true))}
          className="flex shrink-0 items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50"
        >
          {revealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          {revealed ? "Hide amounts" : "Show amounts"}
        </button>
      </div>

      {admin ? (
        <PayrollAdmin revealed={revealed} />
      ) : (
        <MySalary revealed={revealed} />
      )}

      {promptOpen && (
        <UnlockModal
          onClose={() => setPromptOpen(false)}
          onUnlocked={() => {
            setRevealed(true);
            setPromptOpen(false);
          }}
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Admin: run salary and sign off
// ──────────────────────────────────────────────────────────────────────

function PayrollAdmin({ revealed }: { revealed: boolean }) {
  const { data: profiles = [] } = useProfiles();
  const { data: payments = [], isLoading } = usePayrollPayments();
  const create = useCreatePayroll();
  const remove = useDeletePayroll();

  const staff = useMemo(
    () => profiles.filter((profile) => profile.role !== "owner"),
    [profiles],
  );
  const nameOf = useMemo(() => {
    const map = new Map<string, string>();
    for (const profile of profiles) {
      map.set(profile.id, profile.name || profile.phone || profile.id);
    }
    return map;
  }, [profiles]);

  const [staffId, setStaffId] = useState("");
  const [period, setPeriod] = useState(currentPeriod());
  const [salary, setSalary] = useState("");
  const [food, setFood] = useState("");
  const [bonus, setBonus] = useState("");
  const [deductions, setDeductions] = useState("");
  const [note, setNote] = useState("");
  const [signature, setSignature] = useState<string | null>(null);

  const selected = staff.find((profile) => profile.id === staffId);

  // Prefill the amounts from the chosen staff member's configured defaults.
  useEffect(() => {
    if (!selected) return;
    setSalary(String(selected.salary || ""));
    setFood(String(selected.food || ""));
    setBonus(String(selected.bonus || ""));
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const amount = (value: string) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  };
  const total =
    amount(salary) + amount(food) + amount(bonus) - amount(deductions);

  async function run() {
    if (!staffId) {
      addToast({ title: "Choose a staff member", color: "warning" });
      return;
    }
    if (!signature) {
      addToast({ title: "Sign to approve the payment", color: "warning" });
      return;
    }
    try {
      await create.mutateAsync({
        staffId,
        period,
        salary: amount(salary),
        food: amount(food),
        bonus: amount(bonus),
        deductions: amount(deductions),
        note,
        adminSignature: signature,
      });
      addToast({ title: "Salary payment recorded", color: "success" });
      setSignature(null);
      setNote("");
      setStaffId("");
    } catch (err) {
      addToast({
        title: err instanceof Error ? err.message : "Could not save",
        color: "danger",
      });
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
        <div className="overflow-hidden rounded-xl border bg-white shadow-card">
          <div className="border-b bg-slate-50 px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
            Recent payments
          </div>
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg bg-slate-100" />
              ))}
            </div>
          ) : payments.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">
              No salary payments yet.
            </p>
          ) : (
            <div className="divide-y">
              {payments.map((payment) => (
                <div key={payment.id} className="flex flex-wrap items-center gap-3 p-4">
                  <div className="grid size-9 place-items-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                    {initial(nameOf.get(payment.staffId) ?? "?")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {nameOf.get(payment.staffId) ?? payment.staffId}
                    </div>
                    <div className="text-xs text-slate-500">
                      {periodLabel(payment.period)} ·{" "}
                      {payment.status === "signed" ? "Acknowledged" : "Awaiting signature"}
                    </div>
                  </div>
                  <StatusBadge payment={payment} />
                  <MaskedMoney
                    value={payment.total}
                    revealed={revealed}
                    className="text-sm font-semibold"
                  />
                  <SignatureChip label="Admin" src={payment.adminSignature} />
                  <SignatureChip label="Staff" src={payment.staffSignature} />
                  <button
                    type="button"
                    onClick={() => remove.mutate(payment.id)}
                    aria-label="Delete payment"
                    className="grid size-8 place-items-center rounded-md border text-red-500 hover:bg-red-50"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="h-fit rounded-xl border bg-white shadow-card">
          <div className="border-b p-4">
            <h3 className="font-semibold">Run salary</h3>
            <p className="text-xs text-slate-500">
              Amounts default from the staff member's profile.
            </p>
          </div>
          <div className="space-y-3 p-4">
            <div>
              <label className="text-sm font-medium">Staff member</label>
              <select
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value="">Select staff…</option>
                {staff.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name || profile.phone || profile.id}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium">Period</label>
              <input
                type="month"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border px-3 text-sm outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <AmountField label="Salary" value={salary} onChange={setSalary} />
              <AmountField label="Food" value={food} onChange={setFood} />
              <AmountField label="Bonus" value={bonus} onChange={setBonus} />
            </div>
            <AmountField
              label="Deductions"
              value={deductions}
              onChange={setDeductions}
            />

            <div>
              <label className="text-sm font-medium">
                Note <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Half month"
                className="mt-1 h-10 w-full rounded-lg border px-3 text-sm outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5">
              <span className="text-sm text-slate-500">Total</span>
              <Money value={total} className="text-base font-semibold" />
            </div>

            <div>
              <label className="text-sm font-medium">Admin signature</label>
              <div className="mt-1">
                <SignaturePad onChange={setSignature} />
              </div>
            </div>

            <button
              type="button"
              onClick={() => void run()}
              disabled={create.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-3 text-sm font-medium text-white disabled:opacity-40"
            >
              <Plus className="size-4" /> Record & sign payment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AmountField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <input
        type="number"
        min="0"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        className="mt-1 h-10 w-full rounded-lg border px-3 text-sm outline-none focus:ring-2 focus:ring-slate-900"
      />
    </label>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Staff: my payslips and sign-off
// ──────────────────────────────────────────────────────────────────────

function MySalary({ revealed }: { revealed: boolean }) {
  const { session } = useAuth();
  const { data: profiles = [] } = useProfiles();
  const { data: payments = [], isLoading } = usePayrollPayments();
  const sign = useSignPayroll();
  const [signing, setSigning] = useState<PayrollPayment | null>(null);

  const me = profiles.find((profile) => profile.id === session?.userId);
  const outstanding = payments.filter((payment) => payment.status !== "signed");

  return (
    <div className="space-y-4">
      {me && (
        <div className="grid gap-4 sm:grid-cols-3">
          <SummaryCard label="Monthly salary" value={me.salary} revealed={revealed} />
          <SummaryCard label="Food allowance" value={me.food} revealed={revealed} />
          <SummaryCard label="Bonus" value={me.bonus} revealed={revealed} />
        </div>
      )}

      {outstanding.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {outstanding.length} payment{outstanding.length > 1 ? "s" : ""} awaiting
          your signature.
        </div>
      )}

      <div className="overflow-hidden rounded-xl border bg-white shadow-card">
        <div className="border-b bg-slate-50 px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
          Payslips
        </div>
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        ) : payments.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            No payslips yet.
          </p>
        ) : (
          <div className="divide-y">
            {payments.map((payment) => (
              <div key={payment.id} className="flex flex-wrap items-center gap-3 p-4">
                <div className="grid size-9 place-items-center rounded-full bg-slate-100 text-slate-600">
                  <Wallet className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">
                    {periodLabel(payment.period)}
                  </div>
                  <Breakdown payment={payment} revealed={revealed} />
                </div>
                <StatusBadge payment={payment} />
                <MaskedMoney
                  value={payment.total}
                  revealed={revealed}
                  className="text-sm font-semibold"
                />
                {payment.status === "signed" ? (
                  <SignatureChip label="You" src={payment.staffSignature} />
                ) : (
                  <button
                    type="button"
                    onClick={() => setSigning(payment)}
                    className="flex items-center gap-1.5 rounded-lg bg-slate-950 px-3 py-2 text-xs font-medium text-white"
                  >
                    <PenLine className="size-3.5" /> Sign
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {signing && (
        <SignModal
          payment={signing}
          revealed={revealed}
          pending={sign.isPending}
          onClose={() => setSigning(null)}
          onSubmit={async (signature) => {
            try {
              await sign.mutateAsync({ id: signing.id, signature });
              addToast({ title: "Payment acknowledged", color: "success" });
              setSigning(null);
            } catch (err) {
              addToast({
                title: err instanceof Error ? err.message : "Could not sign",
                color: "danger",
              });
            }
          }}
        />
      )}
    </div>
  );
}

function SignModal({
  payment,
  revealed,
  pending,
  onClose,
  onSubmit,
}: {
  payment: PayrollPayment;
  revealed: boolean;
  pending: boolean;
  onClose: () => void;
  onSubmit: (signature: string) => void;
}) {
  const [signature, setSignature] = useState<string | null>(null);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl">
        <h3 className="font-semibold">Acknowledge payment</h3>
        <p className="mt-1 text-sm text-slate-500">
          {periodLabel(payment.period)} · receiving{" "}
          <MaskedMoney
            value={payment.total}
            revealed={revealed}
            className="font-medium"
          />
          . Sign below to confirm.
        </p>
        <div className="mt-4">
          <SignaturePad onChange={setSignature} />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => signature && onSubmit(signature)}
            disabled={!signature || pending}
            className="flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40"
          >
            <PenLine className="size-4" /> Sign & confirm
          </button>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Shared bits
// ──────────────────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  revealed,
}: {
  label: string;
  value: number;
  revealed: boolean;
}) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-card">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-bold">
        <MaskedMoney value={value} revealed={revealed} />
      </div>
    </div>
  );
}

function StatusBadge({ payment }: { payment: PayrollPayment }) {
  const signed = payment.status === "signed";
  return (
    <span
      className={`rounded-full px-2 py-1 text-xs font-medium ${
        signed ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
      }`}
      title={
        signed
          ? `Signed ${signedAtLabel(payment.staffSignedAt)}`
          : "Awaiting staff signature"
      }
    >
      {signed ? "Signed" : "Pending"}
    </span>
  );
}

function Breakdown({
  payment,
  revealed,
}: {
  payment: PayrollPayment;
  revealed: boolean;
}) {
  if (!revealed) {
    return <div className="text-xs text-slate-400">Salary · Food · Bonus</div>;
  }
  const parts = [
    `Salary ${payment.salary}`,
    payment.food ? `Food ${payment.food}` : null,
    payment.bonus ? `Bonus ${payment.bonus}` : null,
    payment.deductions ? `− ${payment.deductions}` : null,
  ].filter(Boolean);
  return <div className="text-xs text-slate-500">{parts.join(" · ")}</div>;
}

/** Money that stays masked until the PIN is re-entered. */
function MaskedMoney({
  value,
  revealed,
  currency = "MVR",
  className,
}: {
  value: number;
  revealed: boolean;
  currency?: Currency;
  className?: string;
}) {
  if (revealed) {
    return <Money value={value} currency={currency} className={className} />;
  }
  return (
    <span
      className={`inline-flex items-center gap-[0.15em] text-slate-400 ${
        className ?? ""
      }`}
    >
      {currency === "USD" ? (
        <span className="shrink-0">$</span>
      ) : (
        <RufiyaaSign className="h-[0.85em] w-[0.835em] shrink-0" />
      )}
      <span className="tracking-[0.2em]">••••</span>
      <span className="sr-only">hidden — enter your PIN to show</span>
    </span>
  );
}

/** PIN prompt used to unmask salary figures. */
function UnlockModal({
  onClose,
  onUnlocked,
}: {
  onClose: () => void;
  onUnlocked: () => void;
}) {
  const { session } = useAuth();
  const verify = useVerifyPin(session);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    setBusy(true);
    try {
      const ok = await verify(pin);
      if (ok) onUnlocked();
      else setError("Incorrect PIN");
    } catch {
      setError("Could not verify the PIN");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-sm rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl">
        <h3 className="font-semibold">Enter your PIN</h3>
        <p className="mt-1 text-sm text-slate-500">
          Confirm your PIN to reveal salary amounts.
        </p>
        <input
          type="password"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          autoFocus
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit();
          }}
          placeholder="••••"
          className="mt-4 h-10 w-full rounded-lg border px-3 text-sm tracking-[0.3em] outline-none focus:ring-2 focus:ring-slate-900"
        />
        {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={pin.length !== 6 || busy}
            className="rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40"
          >
            {busy ? "Checking…" : "Unlock"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SignatureChip({ label, src }: { label: string; src: string | null }) {
  if (!src) {
    return (
      <span className="rounded-md border border-dashed px-2 py-1 text-[10px] text-slate-400">
        {label}: —
      </span>
    );
  }
  return (
    <img
      src={src}
      alt={`${label} signature`}
      className="h-9 w-20 rounded-md border bg-white object-contain"
    />
  );
}
