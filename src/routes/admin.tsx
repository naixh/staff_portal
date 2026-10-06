import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Settings2, ShieldCheck, Trash2, Upload, X } from "lucide-react";
import { addToast } from "@heroui/react";
import { usePaymentMethods, useUpdatePaymentMethods } from "@/hooks/use-payment-methods";
import { Money } from "@/components/money";
import { profilesKey, useProfiles, type Profile } from "@/hooks/use-profiles";
import {
  departmentHasSalonTools,
  departmentLabel,
  useDepartments,
  useUpdateDepartments,
} from "@/hooks/use-departments";
import type { Department, PaymentMethodOption, StaffType } from "@/models/types";
import { getSupabase } from "@/supabase";
import { initial } from "@/utils/format";
import { fileToCompressedDataUrl } from "@/utils/image";
import type { Role } from "@/hooks/use-auth";

function departmentBadgeClass(salonTools: boolean): string {
  return salonTools
    ? "bg-indigo-100 text-indigo-700"
    : "bg-teal-100 text-teal-700";
}

const ROLE_STYLES: Record<Role, string> = {
  owner: "bg-amber-100 text-amber-800",
  admin: "bg-slate-900 text-white",
  staff: "bg-slate-100 text-slate-600",
};

/** Fields an admin can edit on someone else's profile. */
interface ProfilePatch {
  approved?: boolean;
  role?: Role;
  department?: StaffType;
  salary?: number;
  food?: number;
  bonus?: number;
  work_permit?: string | null;
  work_permit_name?: string | null;
}

export function AdminRoute() {
  const queryClient = useQueryClient();
  const { data: profiles = [], isLoading } = useProfiles();

  const updateProfile = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: ProfilePatch }) => {
      const { error } = await getSupabase()
        .from("profiles")
        .update(patch)
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: profilesKey });
      void queryClient.invalidateQueries({
        queryKey: ["work-permit", variables.id],
      });
    },
    onError: (err) => {
      addToast({
        title: err instanceof Error ? err.message : "Update failed",
        color: "danger",
      });
    },
  });

  /** Approving also confirms the auth email (via a SECURITY DEFINER RPC). */
  const approveUser = useMutation({
    mutationFn: approveUserRpc,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: profilesKey });
      addToast({ title: "User approved", color: "success" });
    },
    onError: (err) => {
      addToast({
        title: err instanceof Error ? err.message : "Approval failed",
        color: "danger",
      });
    },
  });

  const pending = profiles.filter((profile) => !profile.approved);
  const approved = profiles.filter((profile) => profile.approved);
  const busy = updateProfile.isPending || approveUser.isPending;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Team</h2>
        <p className="text-sm text-slate-500">
          Approve accounts, set who is salon or other staff, and configure salary,
          food allowance and bonus. The owner is the account that set everything up.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : (
        <>
          <ProfileCard
            title={`Pending (${pending.length})`}
            empty="No accounts are waiting for approval."
            profiles={pending}
            busy={busy}
            onApprove={(id) => approveUser.mutate(id)}
            onRevoke={(id) =>
              updateProfile.mutate({ id, patch: { approved: false } })
            }
            onRole={(id, role) => updateProfile.mutate({ id, patch: { role } })}
            onSave={(id, patch) => updateProfile.mutate({ id, patch })}
          />
          <ProfileCard
            title={`Approved (${approved.length})`}
            empty="No approved users yet."
            profiles={approved}
            busy={busy}
            onApprove={(id) => approveUser.mutate(id)}
            onRevoke={(id) =>
              updateProfile.mutate(
                { id, patch: { approved: false } },
                {
                  onSuccess: () =>
                    addToast({ title: "Access revoked", color: "success" }),
                },
              )
            }
            onRole={(id, role) => updateProfile.mutate({ id, patch: { role } })}
            onSave={(id, patch) => updateProfile.mutate({ id, patch })}
          />
          <PaymentMethodsCard />
          <DepartmentsCard />
        </>
      )}
    </div>
  );
}

function ProfileCard({
  title,
  empty,
  profiles,
  busy,
  onApprove,
  onRevoke,
  onRole,
  onSave,
}: {
  title: string;
  empty: string;
  profiles: Profile[];
  busy: boolean;
  onApprove: (id: string) => void;
  onRevoke: (id: string) => void;
  onRole: (id: string, role: Role) => void;
  onSave: (id: string, patch: ProfilePatch) => void;
}) {
  const [editing, setEditing] = useState<Profile | null>(null);
  const departments = useDepartments();

  return (
    <div className="overflow-hidden rounded-xl border bg-white shadow-card">
      <div className="border-b bg-slate-50 px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
        {title}
      </div>
      {profiles.length === 0 ? (
        <p className="p-8 text-center text-sm text-slate-500">{empty}</p>
      ) : (
        <div className="divide-y">
          {profiles.map((profile) => (
            <div key={profile.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="grid size-9 place-items-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                {initial(profile.name || profile.phone || "?")}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">
                    {profile.name || "(no name)"}
                  </span>
                  <span
                    className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${ROLE_STYLES[profile.role]}`}
                  >
                    {profile.role === "owner" && <ShieldCheck className="size-3" />}
                    {profile.role}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${departmentBadgeClass(
                      departmentHasSalonTools(departments, profile.department),
                    )}`}
                  >
                    {departmentLabel(departments, profile.department)}
                  </span>
                </div>
                <div className="text-xs text-slate-500">
                  {profile.phone || profile.id}
                </div>
              </div>

              {profile.role !== "owner" && (
                <>
                  <select
                    value={profile.role}
                    disabled={busy}
                    onChange={(e) => onRole(profile.id, e.target.value as Role)}
                    aria-label={`Role for ${profile.name ?? "user"}`}
                    className="h-9 rounded-lg border bg-white px-2 text-xs outline-none focus:ring-2 focus:ring-slate-900"
                  >
                    <option value="staff">Staff</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => setEditing(profile)}
                    className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium hover:bg-slate-50"
                  >
                    <Settings2 className="size-3.5" /> Department &amp; pay
                  </button>
                </>
              )}

              {profile.approved ? (
                <button
                  type="button"
                  disabled={busy || profile.role === "owner"}
                  onClick={() => onRevoke(profile.id)}
                  className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-40"
                >
                  <X className="size-3.5" /> Revoke
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onApprove(profile.id)}
                  className="flex items-center gap-1.5 rounded-lg bg-slate-950 px-3 py-2 text-xs font-medium text-white disabled:opacity-40"
                >
                  <Check className="size-3.5" /> Approve
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {editing && (
        <StaffDetailsModal
          profile={editing}
          onClose={() => setEditing(null)}
          onSave={(patch) => {
            onSave(editing.id, patch);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

/**
 * Per-staff settings: which part of the business they work in, their payroll
 * defaults, and their employment work permit.
 */
function StaffDetailsModal({
  profile,
  onClose,
  onSave,
}: {
  profile: Profile;
  onClose: () => void;
  onSave: (patch: ProfilePatch) => void;
}) {
  const [department, setDepartment] = useState<StaffType>(profile.department);
  const departments = useDepartments();
  const [salary, setSalary] = useState(String(profile.salary || ""));
  const [food, setFood] = useState(String(profile.food || ""));
  const [bonus, setBonus] = useState(String(profile.bonus || ""));
  // A locally picked/removed permit. `null` means "unchanged" so an edit that
  // only touches department/pay never overwrites an existing document.
  const [permitDraft, setPermitDraft] = useState<{
    value: string | null;
    name: string | null;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const baseTotal =
    (Number(salary) || 0) + (Number(food) || 0) + (Number(bonus) || 0);

  const permitKey = ["work-permit", profile.id] as const;
  const permitQuery = useQuery({
    queryKey: permitKey,
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from("profiles")
        .select("work_permit,work_permit_name")
        .eq("id", profile.id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data ?? null) as {
        work_permit: string | null;
        work_permit_name: string | null;
      } | null;
    },
  });
  const loaded = permitQuery.data ?? null;
  const permit = permitDraft ? permitDraft.value : (loaded?.work_permit ?? null);
  const permitName = permitDraft
    ? permitDraft.name
    : (loaded?.work_permit_name ?? null);

  async function pickPermit(file: File | undefined) {
    if (!file) return;
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      setPermitDraft({ value: dataUrl, name: file.name });
    } catch (err) {
      addToast({
        title: err instanceof Error ? err.message : "Could not read the file",
        color: "danger",
      });
    }
  }

  async function save() {
    setBusy(true);
    try {
      const patch: ProfilePatch = {
        department,
        salary: Number(salary) || 0,
        food: Number(food) || 0,
        bonus: Number(bonus) || 0,
      };
      // Only send the permit when the admin actually changed it.
      if (permitDraft) {
        patch.work_permit = permitDraft.value;
        patch.work_permit_name = permitDraft.name;
      }
      onSave(patch);
      addToast({ title: "Saved", color: "success" });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">{profile.name || "(no name)"}</h3>
            <p className="text-xs text-slate-500">
              Department, base salary structure and work permit.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-9 place-items-center rounded-lg hover:bg-slate-100"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <label className="text-sm font-medium">Department</label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="mt-1 h-10 w-full rounded-lg border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-900"
            >
              {!departments.some((entry) => entry.id === department) && (
                <option value={department}>
                  {departmentLabel(departments, department)} (not configured)
                </option>
              )}
              {departments.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-400">
              {departmentHasSalonTools(departments, department)
                ? "This department sees sales, services and new sales."
                : "This department only sees attendance and their salary."}
            </p>
          </div>

          <div>
            <label className="text-sm font-medium">Base salary structure</label>
            <div className="mt-1 grid grid-cols-3 gap-2">
              <NumberField label="Basic" value={salary} onChange={setSalary} />
              <NumberField label="Food" value={food} onChange={setFood} />
              <NumberField label="Bonus" value={bonus} onChange={setBonus} />
            </div>
            <div className="mt-2 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
              <span className="text-xs text-slate-500">Base total / month</span>
              <Money value={baseTotal} className="text-sm font-semibold" />
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Prefills each salary run — deductions are entered when you run it.
            </p>
          </div>

          <div>
            <label className="text-sm font-medium">Employment work permit</label>
            {permit ? (
              <div className="mt-1 flex items-center gap-3">
                <img
                  src={permit}
                  alt="Work permit"
                  className="h-20 w-28 rounded-lg border bg-white object-cover"
                />
                <div className="min-w-0 flex-1 text-xs text-slate-500">
                  <div className="truncate">{permitName || "Uploaded document"}</div>
                  <button
                    type="button"
                    onClick={() => setPermitDraft({ value: null, name: null })}
                    className="mt-1 text-rose-600 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <p className="mt-1 text-xs text-slate-400">
                No permit uploaded yet.
              </p>
            )}
            <label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-2.5 text-sm text-slate-500 hover:bg-slate-50">
              <Upload className="size-4" /> {permit ? "Replace image" : "Upload image"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void pickPermit(e.target.files?.[0])}
              />
            </label>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy}
            className="rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function NumberField({
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

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Admin editor for the salon's payment methods (cash / transfer by default). */
function PaymentMethodsCard() {
  const methods = usePaymentMethods();
  const update = useUpdatePaymentMethods();
  const [draft, setDraft] = useState<PaymentMethodOption[]>(methods);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!dirty) setDraft(methods);
  }, [methods, dirty]);

  function edit(index: number, label: string) {
    setDirty(true);
    setDraft((prev) =>
      prev.map((method, i) => (i === index ? { ...method, label } : method)),
    );
  }

  function add() {
    setDirty(true);
    setDraft((prev) => [...prev, { id: "", label: "" }]);
  }

  function remove(index: number) {
    setDirty(true);
    setDraft((prev) => prev.filter((_, i) => i !== index));
  }

  function save() {
    const cleaned: PaymentMethodOption[] = [];
    for (const method of draft) {
      const label = method.label.trim();
      if (!label) continue;
      const id = (method.id || slugify(label)).trim();
      if (!id || cleaned.some((entry) => entry.id === id)) continue;
      cleaned.push({ id, label });
    }
    if (cleaned.length === 0) {
      addToast({ title: "Add at least one method", color: "warning" });
      return;
    }
    update.mutate(cleaned, {
      onSuccess: () => {
        setDirty(false);
        addToast({ title: "Payment methods saved", color: "success" });
      },
      onError: (err) =>
        addToast({
          title: err instanceof Error ? err.message : "Save failed",
          color: "danger",
        }),
    });
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-white shadow-card">
      <div className="flex items-center justify-between border-b bg-slate-50 px-4 py-3">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Payment methods
        </span>
        <button
          type="button"
          onClick={add}
          className="text-xs font-medium hover:underline"
        >
          + Add method
        </button>
      </div>

      <div className="divide-y">
        {draft.map((method, index) => (
          <div key={index} className="flex items-center gap-2 p-3">
            <input
              value={method.label}
              onChange={(e) => edit(index, e.target.value)}
              placeholder="Method name"
              className="h-9 flex-1 rounded-lg border px-3 text-sm outline-none focus:ring-2 focus:ring-slate-900"
            />
            <span className="w-24 truncate text-xs text-slate-400">
              {method.id || slugify(method.label) || "—"}
            </span>
            <button
              type="button"
              onClick={() => remove(index)}
              aria-label="Remove method"
              className="grid size-8 shrink-0 place-items-center rounded-md border text-red-500 hover:bg-red-50"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
        {draft.length === 0 && (
          <p className="p-6 text-center text-sm text-slate-500">
            No payment methods yet.
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t p-3">
        <p className="text-xs text-slate-500">
          Shown when taking payment. Renaming keeps existing sales intact.
        </p>
        <button
          type="button"
          onClick={save}
          disabled={!dirty || update.isPending}
          className="shrink-0 rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          Save
        </button>
      </div>
    </div>
  );
}

/** Admin editor for the staff departments shown when assigning people. */
function DepartmentsCard() {
  const departments = useDepartments();
  const update = useUpdateDepartments();
  const [draft, setDraft] = useState<Department[]>(departments);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!dirty) setDraft(departments);
  }, [departments, dirty]);

  function edit(index: number, patch: Partial<Department>) {
    setDirty(true);
    setDraft((prev) =>
      prev.map((dept, i) => (i === index ? { ...dept, ...patch } : dept)),
    );
  }

  function add() {
    setDirty(true);
    setDraft((prev) => [...prev, { id: "", label: "", salonTools: false }]);
  }

  function remove(index: number) {
    setDirty(true);
    setDraft((prev) => prev.filter((_, i) => i !== index));
  }

  function save() {
    const cleaned: Department[] = [];
    for (const dept of draft) {
      const label = dept.label.trim();
      if (!label) continue;
      const id = (dept.id || slugify(label)).trim();
      if (!id || cleaned.some((entry) => entry.id === id)) continue;
      cleaned.push({ id, label, salonTools: dept.salonTools });
    }
    if (cleaned.length === 0) {
      addToast({ title: "Add at least one department", color: "warning" });
      return;
    }
    update.mutate(cleaned, {
      onSuccess: () => {
        setDirty(false);
        addToast({ title: "Departments saved", color: "success" });
      },
      onError: (err) =>
        addToast({
          title: err instanceof Error ? err.message : "Save failed",
          color: "danger",
        }),
    });
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-white shadow-card">
      <div className="flex items-center justify-between border-b bg-slate-50 px-4 py-3">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Departments
        </span>
        <button
          type="button"
          onClick={add}
          className="text-xs font-medium hover:underline"
        >
          + Add department
        </button>
      </div>

      <div className="divide-y">
        {draft.map((dept, index) => (
          <div key={index} className="flex flex-wrap items-center gap-2 p-3">
            <input
              value={dept.label}
              onChange={(e) => edit(index, { label: e.target.value })}
              placeholder="Department name"
              className="h-9 min-w-[10rem] flex-1 rounded-lg border px-3 text-sm outline-none focus:ring-2 focus:ring-slate-900"
            />
            <span className="w-24 truncate text-xs text-slate-400">
              {dept.id || slugify(dept.label) || "—"}
            </span>
            <label className="flex items-center gap-1.5 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={dept.salonTools}
                onChange={(e) => edit(index, { salonTools: e.target.checked })}
              />
              Salon tools
            </label>
            <button
              type="button"
              onClick={() => remove(index)}
              aria-label="Remove department"
              className="grid size-8 shrink-0 place-items-center rounded-md border text-red-500 hover:bg-red-50"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
        {draft.length === 0 && (
          <p className="p-6 text-center text-sm text-slate-500">
            No departments yet.
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t p-3">
        <p className="text-xs text-slate-500">
          Tick “Salon tools” for departments that should see sales and services.
        </p>
        <button
          type="button"
          onClick={save}
          disabled={!dirty || update.isPending}
          className="shrink-0 rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          Save
        </button>
      </div>
    </div>
  );
}

/**
 * Approve a user through the `approve_user` RPC, which flips `approved` *and*
 * confirms the auth email so the account can sign in straight away.
 *
 * Right after the migration is applied PostgREST may still be reloading its
 * schema cache and briefly reports the function as missing, so retry once
 * before surfacing a clear, actionable error.
 */
async function approveUserRpc(id: string): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { error } = await getSupabase().rpc("approve_user", { target: id });
    if (!error) return;
    if (isMissingFunction(error) && attempt === 0) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      continue;
    }
    if (isMissingFunction(error)) {
      throw new Error(
        "Approval function is missing — run supabase/migrations/0006_approve.sql.",
      );
    }
    throw new Error(error.message);
  }
}

/** PostgREST reports a function it doesn't know yet with this code. */
function isMissingFunction(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "PGRST202" ||
    (error.message ?? "").includes("Could not find the function")
  );
}
