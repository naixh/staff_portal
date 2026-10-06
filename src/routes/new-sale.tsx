import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { addToast } from "@heroui/react";
import { useAuth } from "@/hooks/use-auth";
import { useServices } from "@/hooks/use-services";
import { useCreateSale } from "@/hooks/use-sales";
import { usePaymentMethods } from "@/hooks/use-payment-methods";
import { CURRENCIES, type Currency, type PaymentMethod, type SaleItem } from "@/models/types";
import { Money, RufiyaaSign } from "@/components/money";
import { paymentIcon, serviceIcon } from "@/utils/ui";

export function NewSaleRoute() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { data: services = [], isLoading: servicesLoading } = useServices();
  const createSale = useCreateSale();
  const methods = usePaymentMethods();

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("");
  const [currency, setCurrency] = useState<Currency>("MVR");
  const [tips, setTips] = useState(0);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [dialogOpen, setDialogOpen] = useState(false);

  // A sale is always recorded against the signed-in barber — staff can't enter
  // sales on someone else's behalf.
  const barberId = session?.barberId ?? "";
  const barberName = session?.name ?? "";

  const items = useMemo<SaleItem[]>(
    () =>
      Object.entries(cart)
        .map(([serviceId, qty]) => {
          if (qty <= 0) return null;
          const svc = services.find((s) => s.id === serviceId);
          if (!svc) return null;
          const price =
            currency === "USD" ? (svc.priceUsd ?? svc.price) : svc.price;
          return {
            serviceId: svc.id,
            serviceName: svc.name,
            price,
            quantity: qty,
          };
        })
        .filter((x): x is SaleItem => x !== null),
    [cart, services, currency],
  );

  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const total = subtotal + tips;

  // Default to the first configured payment method.
  useEffect(() => {
    if (!paymentMethod && methods.length > 0) setPaymentMethod(methods[0].id);
  }, [methods, paymentMethod]);

  function addService(serviceId: string) {
    setCart((prev) => ({ ...prev, [serviceId]: (prev[serviceId] ?? 0) + 1 }));
  }

  function removeService(serviceId: string) {
    setCart((prev) => {
      const next = { ...prev };
      delete next[serviceId];
      return next;
    });
  }

  function openPayment() {
    if (!barberId) {
      addToast({ title: "You need to be signed in", color: "warning" });
      return;
    }
    if (items.length === 0) {
      addToast({ title: "Add at least one service", color: "warning" });
      return;
    }
    setDialogOpen(true);
  }

  async function handleComplete() {
    if (!barberId) {
      addToast({ title: "You need to be signed in", color: "warning" });
      return;
    }
    await createSale.mutateAsync({
      items,
      total,
      tips,
      barberId,
      barberName,
      paymentMethod,
      currency,
      soldAt: new Date().toISOString(),
    });
    addToast({ title: "Sale completed", color: "success" });
    setDialogOpen(false);
    navigate({ to: "/sales" });
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
      <div className="space-y-5">
        <div className="rounded-xl border bg-white shadow-card">
          <div className="flex items-center justify-between gap-2 border-b p-4">
            <div>
              <h3 className="font-semibold">Select services</h3>
              <p className="text-xs text-slate-500">
                Add one or more services to this sale.
              </p>
            </div>
            <div className="flex shrink-0 rounded-lg border p-0.5">
              {CURRENCIES.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setCurrency(option)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    currency === option
                      ? "bg-slate-950 text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          {servicesLoading ? (
            <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-32 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : services.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">
              No services yet. Add some from the Services page.
            </p>
          ) : (
            <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
              {services.map((svc) => {
                const Icon = serviceIcon(svc.category);
                const qty = cart[svc.id] ?? 0;
                const noUsd = currency === "USD" && svc.priceUsd === undefined;
                const unitPrice =
                  currency === "USD" ? (svc.priceUsd ?? svc.price) : svc.price;
                return (
                  <button
                    key={svc.id}
                    type="button"
                    disabled={noUsd}
                    onClick={() => addService(svc.id)}
                    className={`group flex items-center gap-3 rounded-xl border bg-white p-3 text-left transition hover:border-slate-400 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60 ${
                      qty > 0 ? "border-slate-900" : ""
                    }`}
                  >
                    <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-slate-100">
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {svc.name}
                      </div>
                      {noUsd && (
                        <div className="text-xs text-amber-600">No USD price</div>
                      )}
                    </div>
                    <div className="shrink-0 text-sm text-slate-500">
                      <Money value={unitPrice} currency={currency} />
                    </div>
                    {qty > 0 ? (
                      <span className="shrink-0 rounded-full bg-slate-950 px-2 py-0.5 text-xs font-semibold text-white">
                        ×{qty}
                      </span>
                    ) : (
                      <Plus className="size-4 shrink-0 text-slate-400 group-hover:text-slate-900" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="h-fit rounded-xl border bg-white shadow-card xl:sticky xl:top-20">
        <div className="border-b p-4">
          <h3 className="font-semibold">Sale summary</h3>
          <p className="text-xs text-slate-500">Review before payment</p>
        </div>

        <div className="min-h-32 divide-y">
          {items.length === 0 ? (
            <div className="p-8 text-center">
              <div className="mx-auto grid size-10 place-items-center rounded-full bg-slate-100">
                <ShoppingBag className="size-4" />
              </div>
              <div className="mt-2 text-sm font-medium">No services added</div>
              <div className="text-xs text-slate-500">
                Select a service to start a sale.
              </div>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.serviceId} className="flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {item.serviceName}
                  </div>
                  <div className="text-xs text-slate-500">
                    <Money value={item.price} currency={currency} /> × {item.quantity}
                  </div>
                </div>
                <div className="text-sm font-semibold">
                  <Money value={item.price * item.quantity} currency={currency} />
                </div>
                <button
                  type="button"
                  onClick={() => removeService(item.serviceId)}
                  aria-label={`Remove ${item.serviceName}`}
                  className="grid size-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="space-y-3 border-t p-4">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Subtotal</span>
            <span><Money value={subtotal} currency={currency} /></span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Tips</span>
            <span><Money value={tips} currency={currency} /></span>
          </div>
          <div className="flex justify-between text-base font-semibold">
            <span>Total</span>
            <span><Money value={total} currency={currency} /></span>
          </div>
          <button
            type="button"
            onClick={openPayment}
            disabled={items.length === 0}
            className="w-full rounded-lg bg-slate-950 px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Proceed to Payment
          </button>
        </div>
      </div>

      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-lg rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b p-4">
              <div>
                <h3 className="font-semibold">Complete payment</h3>
                <p className="text-xs text-slate-500">
                  Choose payment type and record tips.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDialogOpen(false)}
                aria-label="Close"
                className="grid size-9 place-items-center rounded-lg hover:bg-slate-100"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-4 p-4">
              <div className="rounded-xl bg-slate-50 p-4">
                <div className="text-xs text-slate-500">Sale total</div>
                <div className="mt-1 text-2xl font-bold">
                  <Money value={total} currency={currency} />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Payment type</label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {methods.map((method) => {
                    const Icon = paymentIcon(method.id);
                    const active = paymentMethod === method.id;
                    return (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => setPaymentMethod(method.id)}
                        className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-3 text-sm font-medium transition-colors ${
                          active ? "tab-active" : "hover:bg-slate-50"
                        }`}
                      >
                        <Icon className="size-4" /> {method.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">
                  Tips{" "}
                  <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <div className="relative mt-2">
                  {currency === "USD" ? (
                    <span className="absolute left-3 top-2.5 text-sm text-slate-400">
                      $
                    </span>
                  ) : (
                    <RufiyaaSign className="absolute left-3 top-3 size-4 text-slate-400" />
                  )}
                  <input
                    type="number"
                    min="0"
                    value={tips}
                    onChange={(e) => setTips(Math.max(0, Number(e.target.value) || 0))}
                    className="h-10 w-full rounded-lg border bg-white pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => void handleComplete()}
                disabled={createSale.isPending}
                className="w-full rounded-lg bg-slate-950 px-4 py-3 text-sm font-medium text-white disabled:opacity-40"
              >
                {createSale.isPending ? "Saving…" : "Complete Sale"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
