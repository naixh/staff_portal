import { useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { addToast } from "@heroui/react";
import { Money } from "@/components/money";
import { useSales, useDeleteSale, useUpdateSale } from "@/hooks/use-sales";
import { usePaymentMethods } from "@/hooks/use-payment-methods";
import { useServices } from "@/hooks/use-services";
import { canManageTeam, useAuth } from "@/hooks/use-auth";
import { canUseSalonTools, useDepartments } from "@/hooks/use-departments";
import type { PaymentMethod, Sale, SaleItem, Service } from "@/models/types";
import { formatTime } from "@/utils/format";
import { paymentBadgeClass, paymentLabel } from "@/utils/ui";

function saleLabel(sale: Sale): string {
  return sale.items.map((item) => item.serviceName).join(" + ") || "Sale";
}

function invoiceNo(id: string): string {
  return `#INV-${id.slice(0, 5).toUpperCase()}`;
}

/** Small pill marking a sale that has been corrected. */
function EditedBadge() {
  return (
    <span className="mt-0.5 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
      Edited
    </span>
  );
}

export function SalesRoute() {
  const { data: sales = [], isLoading } = useSales();
  const deleteSale = useDeleteSale();
  const methods = usePaymentMethods();
  const { session } = useAuth();
  const departments = useDepartments();
  const [filter, setFilter] = useState<"all" | PaymentMethod>("all");
  const [editing, setEditing] = useState<Sale | null>(null);

  // Floor staff correct their sales; owners/admins review and delete them.
  const isAdmin = canManageTeam(session?.role);
  const canEdit = canUseSalonTools(session, departments) && !isAdmin;

  const filtered = useMemo(
    () =>
      filter === "all"
        ? sales
        : sales.filter((s) => s.paymentMethod === filter),
    [sales, filter],
  );

  async function handleDelete(id: string) {
    await deleteSale.mutateAsync(id);
    addToast({ title: "Sale deleted", color: "success" });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Sales</h2>
          <p className="text-sm text-slate-500">
            Track cash, transfers, tips and receipts.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {[{ id: "all", label: "All" }, ...methods].map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setFilter(option.id)}
              className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                filter === option.id
                  ? "tab-active border-slate-950"
                  : "bg-white hover:bg-slate-50"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white shadow-card">
        <div className="hidden grid-cols-[110px_1fr_120px_90px_130px_70px] border-b bg-slate-50 px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500 sm:grid">
          <div>Invoice</div>
          <div>Service / Barber</div>
          <div>Payment</div>
          <div>Tips</div>
          <div className="text-right">Total</div>
          <div />
        </div>

        {isLoading ? (
          <div className="divide-y">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-4">
                <div className="h-10 animate-pulse rounded bg-slate-100" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
            <div className="grid size-10 place-items-center rounded-full bg-slate-100">
              <Plus className="size-4" />
            </div>
            <p className="font-medium text-slate-500">No sales yet</p>
            <p className="text-sm text-slate-500">
              Record your first sale to see it here.
            </p>
            <Link
              to="/sales/new"
              className="mt-2 flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white"
            >
              <Plus className="size-4" /> New Sale
            </Link>
          </div>
        ) : (
          <div className="divide-y">
            {filtered.map((sale) => {
              const tipsChanged =
                sale.previous !== undefined &&
                (sale.previous.tips ?? 0) !== (sale.tips ?? 0);
              const methodChanged =
                sale.previous !== undefined &&
                sale.previous.paymentMethod !== sale.paymentMethod;
              return (
                <div
                  key={sale.id}
                  className="grid gap-2 p-4 sm:grid-cols-[110px_1fr_120px_90px_130px_70px] sm:items-center"
                >
                  <div className="text-sm font-medium">
                    <div>{invoiceNo(sale.id)}</div>
                    {sale.previous && <EditedBadge />}
                  </div>
                  <div className="min-w-0">
                    <div className="break-words text-sm">{saleLabel(sale)}</div>
                    <div className="text-xs text-slate-500">
                      {sale.barberName} · {formatTime(sale.soldAt)}
                    </div>
                  </div>
                  <div>
                    <span
                      className={`rounded-full px-2 py-1 text-xs ${
                        methodChanged
                          ? "bg-amber-100 text-amber-800"
                          : paymentBadgeClass(methods, sale.paymentMethod)
                      }`}
                    >
                      {paymentLabel(methods, sale.paymentMethod)}
                    </span>
                    {methodChanged && sale.previous && (
                      <span className="ml-1 text-[10px] text-slate-400 line-through">
                        {paymentLabel(methods, sale.previous.paymentMethod)}
                      </span>
                    )}
                  </div>
                  <div className="text-sm">
                    {tipsChanged && sale.previous && (
                      <span className="mr-1 text-xs text-slate-400 line-through">
                        <Money
                          value={sale.previous.tips ?? 0}
                          currency={sale.currency}
                        />
                      </span>
                    )}
                    <span className={tipsChanged ? "font-medium text-amber-800" : ""}>
                      <Money value={sale.tips ?? 0} currency={sale.currency} />
                    </span>
                  </div>
                  <div className="text-sm font-semibold sm:text-right">
                    {sale.previous ? (
                      <>
                        <span className="mr-2 text-xs font-normal text-slate-400 line-through">
                          <Money
                            value={sale.previous.total}
                            currency={sale.currency}
                          />
                        </span>
                        <span className="rounded bg-amber-100 px-1 text-amber-800">
                          <Money value={sale.total} currency={sale.currency} />
                        </span>
                      </>
                    ) : (
                      <Money value={sale.total} currency={sale.currency} />
                    )}
                  </div>
                  <div className="flex gap-1 sm:justify-end">
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => setEditing(sale)}
                        aria-label="Edit sale"
                        className="grid size-7 place-items-center rounded-md border text-slate-600 hover:bg-slate-50"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => void handleDelete(sale.id)}
                        aria-label="Delete sale"
                        className="grid size-7 place-items-center rounded-md border text-red-500 hover:bg-red-50"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {editing && (
        <EditSaleDialog sale={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

/**
 * Correction dialog. Every field shows the value it had before the change
 * (struck through) and highlights anything you edit.
 */
/** One editable line in the correction dialog. */
interface EditRow {
  key: string;
  /** The line as recorded (null for lines added during this edit). */
  original: SaleItem | null;
  item: SaleItem;
}

/**
 * Correction dialog. Every line can have its service, price and quantity
 * changed, lines can be added or removed, and anything you edit is highlighted
 * while the value it had before is shown struck through.
 */
function EditSaleDialog({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  const update = useUpdateSale();
  const methods = usePaymentMethods();
  const { data: services = [] } = useServices();
  const keyRef = useRef(0);
  const saleCurrency = sale.currency ?? "MVR";
  const unitPriceOf = (service: Service) =>
    saleCurrency === "USD" ? (service.priceUsd ?? service.price) : service.price;

  const [rows, setRows] = useState<EditRow[]>(() =>
    sale.items.map((item) => ({
      key: `r${keyRef.current++}`,
      original: item,
      item: { ...item },
    })),
  );
  const [tips, setTips] = useState(String(sale.tips ?? 0));
  const [method, setMethod] = useState<PaymentMethod>(sale.paymentMethod);

  const originalTips = sale.tips ?? 0;
  const nextTips = Number(tips) || 0;
  const currentItems = rows.map((row) => row.item);
  const subtotal = currentItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  const total = subtotal + nextTips;

  const removed = sale.items.filter(
    (original) => !rows.some((row) => row.original === original),
  );
  const itemsChanged =
    JSON.stringify(currentItems) !== JSON.stringify(sale.items);
  const tipsChanged = nextTips !== originalTips;
  const methodChanged = method !== sale.paymentMethod;
  const changed = itemsChanged || tipsChanged || methodChanged;
  const totalChanged = total !== sale.total;

  function setService(index: number, serviceId: string) {
    const service = services.find((entry) => entry.id === serviceId);
    setRows((prev) =>
      prev.map((row, i) =>
        i === index
          ? {
              ...row,
              item: service
                ? {
                    ...row.item,
                    serviceId: service.id,
                    serviceName: service.name,
                    price: unitPriceOf(service),
                  }
                : { ...row.item, serviceId },
            }
          : row,
      ),
    );
  }

  function patchItem(index: number, patch: Partial<SaleItem>) {
    setRows((prev) =>
      prev.map((row, i) =>
        i === index ? { ...row, item: { ...row.item, ...patch } } : row,
      ),
    );
  }

  function addRow() {
    const first = services[0];
    setRows((prev) => [
      ...prev,
      {
        key: `r${keyRef.current++}`,
        original: null,
        item: first
          ? {
              serviceId: first.id,
              serviceName: first.name,
              price: unitPriceOf(first),
              quantity: 1,
            }
          : { serviceId: "", serviceName: "Service", price: 0, quantity: 1 },
      },
    ]);
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  async function save() {
    if (currentItems.length === 0) {
      addToast({ title: "A sale needs at least one service", color: "warning" });
      return;
    }
    try {
      await update.mutateAsync({
        id: sale.id,
        patch: {
          items: currentItems,
          tips: nextTips,
          total,
          paymentMethod: method,
        },
      });
      addToast({ title: "Sale updated", color: "success" });
      onClose();
    } catch (err) {
      addToast({
        title: err instanceof Error ? err.message : "Update failed",
        color: "danger",
      });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Edit sale</h3>
            <p className="text-xs text-slate-500">
              {invoiceNo(sale.id)} · {sale.barberName} · {formatTime(sale.soldAt)} ·{" "}
              {saleCurrency}
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

        <div className="mt-4 space-y-3">
          {rows.map((row, index) => {
            const before = row.original;
            const serviceChanged =
              before !== null && before.serviceId !== row.item.serviceId;
            const priceChanged =
              before !== null && before.price !== row.item.price;
            const qtyChanged =
              before !== null && before.quantity !== row.item.quantity;
            return (
              <div
                key={row.key}
                className={`rounded-lg border p-3 ${
                  serviceChanged ? "border-amber-400 bg-amber-50/40" : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  <select
                    value={row.item.serviceId}
                    onChange={(e) => setService(index, e.target.value)}
                    aria-label="Service"
                    className="h-9 min-w-0 flex-1 rounded-md border bg-white px-2 text-sm outline-none focus:ring-2 focus:ring-slate-900"
                  >
                    {!services.some((s) => s.id === row.item.serviceId) && (
                      <option value={row.item.serviceId}>
                        {row.item.serviceName}
                      </option>
                    )}
                    {services.map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.name} · {unitPriceOf(service)}
                      </option>
                    ))}
                  </select>
                  {before === null && (
                    <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">
                      New
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeRow(index)}
                    aria-label="Remove service"
                    className="grid size-8 shrink-0 place-items-center rounded-md border text-red-500 hover:bg-red-50"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>

                {serviceChanged && before && (
                  <p className="mt-1 text-xs text-slate-500">
                    Was{" "}
                    <span className="line-through">
                      {before.serviceName} ·{" "}
                      <Money value={before.price} currency={saleCurrency} />
                    </span>
                  </p>
                )}

                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="text-xs text-slate-500">Price</span>
                    <input
                      type="number"
                      min="0"
                      value={row.item.price}
                      onChange={(e) =>
                        patchItem(index, { price: Number(e.target.value) || 0 })
                      }
                      className={`mt-1 h-9 w-full rounded-md border px-2 text-sm outline-none focus:ring-2 focus:ring-slate-900 ${
                        priceChanged ? "border-amber-400 bg-amber-50" : ""
                      }`}
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-slate-500">Quantity</span>
                    <input
                      type="number"
                      min="1"
                      value={row.item.quantity}
                      onChange={(e) =>
                        patchItem(index, {
                          quantity: Math.max(1, Number(e.target.value) || 1),
                        })
                      }
                      className={`mt-1 h-9 w-full rounded-md border px-2 text-sm outline-none focus:ring-2 focus:ring-slate-900 ${
                        qtyChanged ? "border-amber-400 bg-amber-50" : ""
                      }`}
                    />
                  </label>
                </div>
              </div>
            );
          })}

          {removed.length > 0 && (
            <div className="rounded-lg border border-dashed p-3 text-xs text-slate-400">
              {removed.map((item, i) => (
                <div key={i}>
                  Removed:{" "}
                  <span className="line-through">
                    {item.serviceName} ·{" "}
                    <Money value={item.price} currency={saleCurrency} />
                  </span>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={addRow}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <Plus className="size-4" /> Add service
          </button>
        </div>

        <div className="mt-3">
          <label className="text-sm font-medium">Payment method</label>
          <div className="mt-1 flex flex-wrap gap-2">
            {methods.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setMethod(option.id)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                  method === option.id
                    ? "bg-slate-950 text-white"
                    : "bg-white hover:bg-slate-50"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          {methodChanged && (
            <p className="mt-1 text-xs text-slate-500">
              Was{" "}
              <span className="line-through">
                {paymentLabel(methods, sale.paymentMethod)}
              </span>{" "}
              →{" "}
              <span className="font-medium text-amber-700">
                {paymentLabel(methods, method)}
              </span>
            </p>
          )}
        </div>

        <div className="mt-3">
          <label className="text-sm font-medium">Tips</label>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="number"
              min="0"
              value={tips}
              onChange={(e) => setTips(e.target.value)}
              className={`h-10 w-full rounded-lg border px-3 text-sm outline-none focus:ring-2 focus:ring-slate-900 ${
                tipsChanged ? "border-amber-400 bg-amber-50" : ""
              }`}
            />
            {tipsChanged && (
              <span className="shrink-0 text-xs text-slate-400 line-through">
                <Money value={originalTips} currency={saleCurrency} />
              </span>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5">
          <span className="text-sm text-slate-500">New total</span>
          <span className="flex items-center gap-2">
            {totalChanged && (
              <span className="text-xs text-slate-400 line-through">
                <Money value={sale.total} currency={saleCurrency} />
              </span>
            )}
            <Money
              value={total}
              currency={saleCurrency}
              className={`text-base font-semibold ${totalChanged ? "text-amber-800" : ""}`}
            />
          </span>
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
            onClick={() => void save()}
            disabled={!changed || update.isPending}
            className="rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40"
          >
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}
