import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ShieldCheck, Trash2, UserPlus, X } from "lucide-react";
import { addToast } from "@heroui/react";
import { useCreateBarber, useDeleteBarber, useUpdateBarber } from "@/hooks/use-barbers";
import { useUpdateProfile } from "@/hooks/use-profiles";
import { useStaffRoster, type RosterMember } from "@/hooks/use-staff-roster";
import { departmentLabel, useDepartments } from "@/hooks/use-departments";
import { isSupabaseConfigured } from "@/supabase";
import { initial } from "@/utils/format";
import { hashPin, isValidMobile, isValidPin, normalizeMobile } from "@/utils/pin";

/**
 * Staff directory for owners/admins.
 *
 * Members come from the shared accounts (not the per-account local roster), so
 * everyone shows up — including newly created accounts and non-salon
 * departments. Access and pay are managed on the Team page.
 */
export function BarbersRoute() {
  const { members, isLoading } = useStaffRoster();
  const departments = useDepartments();
  const deleteBarber = useDeleteBarber();
  const createBarber = useCreateBarber();

  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [breakMinutes, setBreakMinutes] = useState("");

  const sorted = [...members].sort((a, b) => {
    const byDepartment = (a.department ?? "").localeCompare(b.department ?? "");
    if (byDepartment !== 0) return byDepartment;
    return a.name.localeCompare(b.name);
  });

  function closeModal() {
    setModalOpen(false);
    setName("");
    setPhone("");
    setPin("");
    setBreakMinutes("");
  }

  async function handleAdd() {
    const trimmed = name.trim();
    if (!trimmed) {
      addToast({ title: "Enter a name", color: "warning" });
      return;
    }
    const mobile = normalizeMobile(phone);
    if (mobile && !isValidMobile(mobile)) {
      addToast({ title: "Enter a valid mobile number", color: "warning" });
      return;
    }
    if (pin && !isValidPin(pin)) {
      addToast({ title: "PIN must be 6 digits", color: "warning" });
      return;
    }
    if (pin && !mobile) {
      addToast({ title: "Add a mobile number to set a PIN", color: "warning" });
      return;
    }
    const parsedBreak = Number(breakMinutes);
    const breakValue =
      breakMinutes.trim() === "" || Number.isNaN(parsedBreak)
        ? undefined
        : Math.max(0, Math.round(parsedBreak));
    const pinHash = pin ? await hashPin(mobile, pin) : undefined;
    await createBarber.mutateAsync({
      name: trimmed,
      phone: mobile || undefined,
      pinHash,
      breakMinutes: breakValue,
    });
    addToast({ title: "Staff member added", color: "success" });
    closeModal();
  }

  async function handleDelete(id: string) {
    await deleteBarber.mutateAsync(id);
    addToast({ title: "Staff member removed", color: "success" });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Staff</h2>
          <p className="text-sm text-slate-500">
            Everyone with an account. Set the daily break allowance here;{" "}
            <Link to="/admin" className="font-medium underline">
              manage access and pay on the Team page
            </Link>
            .
          </p>
        </div>
        {!isSupabaseConfigured && (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white"
          >
            <UserPlus className="size-4" /> Add staff
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border bg-white shadow-card">
        {isLoading ? (
          <div className="divide-y">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-4">
                <div className="h-10 animate-pulse rounded bg-slate-100" />
              </div>
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
            <div className="grid size-10 place-items-center rounded-full bg-slate-100">
              <UserPlus className="size-4" />
            </div>
            <p className="font-medium text-slate-500">No staff yet</p>
            <p className="text-sm text-slate-500">
              Accounts appear here once someone signs up.
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {sorted.map((member) => (
              <div
                key={member.id}
                className="flex flex-wrap items-center gap-3 p-4"
              >
                <div className="grid size-9 place-items-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                  {initial(member.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium">
                      {member.name}
                    </span>
                    {member.department && (
                      <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-700">
                        {departmentLabel(departments, member.department)}
                      </span>
                    )}
                    {!member.approved && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                        Pending
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500">
                    {member.phone || "Staff"}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <BreakEditor member={member} />
                  {member.source === "local" && (
                    <button
                      type="button"
                      onClick={() => void handleDelete(member.id)}
                      aria-label={`Remove ${member.name}`}
                      className="grid size-8 place-items-center rounded-md border text-red-500 hover:bg-red-50"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {!isSupabaseConfigured && (
        <p className="flex items-center gap-2 text-xs text-slate-400">
          <ShieldCheck className="size-3.5" /> Offline mode — staff are stored on
          this device only.
        </p>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-lg rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b p-4">
              <h3 className="font-semibold">Add staff member</h3>
              <button
                type="button"
                onClick={closeModal}
                aria-label="Close"
                className="grid size-9 place-items-center rounded-lg hover:bg-slate-100"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-3 p-4">
              <div>
                <label className="text-sm font-medium">Name</label>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Barber name"
                  className="mt-1 h-10 w-full rounded-lg border px-3 text-sm outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <div>
                <label className="text-sm font-medium">
                  Mobile number{" "}
                  <span className="font-normal text-slate-400">(for sign-in)</span>
                </label>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="7XXXXXX"
                  className="mt-1 h-10 w-full rounded-lg border px-3 text-sm outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <div>
                <label className="text-sm font-medium">
                  Daily break{" "}
                  <span className="font-normal text-slate-400">(minutes)</span>
                </label>
                <input
                  type="number"
                  min="0"
                  value={breakMinutes}
                  onChange={(e) => setBreakMinutes(e.target.value)}
                  placeholder="30"
                  className="mt-1 h-10 w-full rounded-lg border px-3 text-sm outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <div>
                <label className="text-sm font-medium">
                  PIN{" "}
                  <span className="font-normal text-slate-400">
                    (offline sign-in only)
                  </span>
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleAdd();
                  }}
                  placeholder="••••••"
                  className="mt-1 h-10 w-full rounded-lg border px-3 text-sm tracking-[0.3em] outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t p-4">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleAdd()}
                disabled={createBarber.isPending}
                className="rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Inline editor for a staff member's daily break allowance (minutes). */
function BreakEditor({ member }: { member: RosterMember }) {
  const updateProfile = useUpdateProfile();
  const updateBarber = useUpdateBarber();
  const [value, setValue] = useState(
    member.breakMinutes !== null && member.breakMinutes !== undefined
      ? String(member.breakMinutes)
      : "",
  );

  function save() {
    const trimmed = value.trim();
    const parsed = trimmed === "" ? null : Number(trimmed);
    const next =
      parsed === null || Number.isNaN(parsed) ? null : Math.max(0, Math.round(parsed));
    if (next === (member.breakMinutes ?? null)) return;

    if (member.source === "account") {
      updateProfile.mutate(
        { id: member.id, patch: { break_minutes: next } },
        {
          onError: (err) =>
            addToast({
              title:
                err instanceof Error
                  ? err.message
                  : "Could not save break time",
              color: "danger",
            }),
        },
      );
    } else {
      updateBarber.mutate(
        { id: member.id, patch: { breakMinutes: next ?? undefined } },
        {
          onError: () =>
            addToast({ title: "Could not save break time", color: "danger" }),
        },
      );
    }
  }

  return (
    <label className="flex items-center gap-1 text-xs text-slate-500">
      Break
      <input
        type="number"
        min="0"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        placeholder="0"
        aria-label={`Daily break minutes for ${member.name}`}
        className="h-8 w-16 rounded-md border px-2 text-center text-xs outline-none focus:ring-2 focus:ring-slate-900"
      />
      min
    </label>
  );
}
