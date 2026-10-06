import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { addToast } from "@heroui/react";
import {
  usePaymentMethods,
  useUpdatePaymentMethods,
} from "@/hooks/use-payment-methods";
import {
  useDepartments,
  useUpdateDepartments,
} from "@/hooks/use-departments";
import type { Department, PaymentMethodOption } from "@/models/types";

/**
 * Salon-wide settings shown in the top-bar settings dialog: the payment methods
 * offered at checkout and the departments staff can be assigned to.
 */
function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Admin editor for the salon's payment methods (cash / transfer by default). */
export function PaymentMethodsCard() {
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
export function DepartmentsCard() {
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
