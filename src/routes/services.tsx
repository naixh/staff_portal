import { useMemo, useState } from "react";
import { Download, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { addToast } from "@heroui/react";
import {
  useServices,
  useCreateService,
  useUpdateService,
  useDeleteService,
} from "@/hooks/use-services";
import { PRICE_LIST } from "@/data/price-list";
import type { Service } from "@/models/types";
import { Money, RufiyaaSign } from "@/components/money";

export function ServicesRoute() {
  const { data: services = [], isLoading } = useServices();
  const createService = useCreateService();
  const updateService = useUpdateService();
  const deleteService = useDeleteService();

  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [priceUsd, setPriceUsd] = useState("");
  const [category, setCategory] = useState("");
  const [importing, setImporting] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return services;
    return services.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.category ?? "").toLowerCase().includes(q),
    );
  }, [services, query]);

  const saving = createService.isPending || updateService.isPending;

  function openAdd() {
    setEditingId(null);
    setName("");
    setPrice("");
    setPriceUsd("");
    setCategory("");
    setModalOpen(true);
  }

  function openEdit(service: Service) {
    setEditingId(service.id);
    setName(service.name);
    setPrice(String(service.price));
    setPriceUsd(service.priceUsd !== undefined ? String(service.priceUsd) : "");
    setCategory(service.category ?? "");
    setModalOpen(true);
  }

  async function handleSave() {
    const priceNum = Number(price);
    if (!name.trim()) {
      addToast({ title: "Enter a name", color: "warning" });
      return;
    }
    if (Number.isNaN(priceNum) || priceNum < 0) {
      addToast({ title: "Enter a valid price", color: "warning" });
      return;
    }
    const usdRaw = priceUsd.trim();
    const usdNum = usdRaw === "" ? undefined : Number(usdRaw);
    if (usdNum !== undefined && (Number.isNaN(usdNum) || usdNum < 0)) {
      addToast({ title: "Enter a valid USD price", color: "warning" });
      return;
    }
    const payload = {
      name: name.trim(),
      price: priceNum,
      priceUsd: usdNum,
      category: category.trim() || undefined,
    };
    if (editingId) {
      await updateService.mutateAsync({ id: editingId, patch: payload });
      addToast({ title: "Service updated", color: "success" });
    } else {
      await createService.mutateAsync(payload);
      addToast({ title: "Service added", color: "success" });
    }
    setModalOpen(false);
  }

  async function handleDelete(id: string) {
    await deleteService.mutateAsync(id);
    addToast({ title: "Service removed", color: "success" });
  }

  /** Add any price-list services that aren't in the catalog yet (by name). */
  async function loadPriceList() {
    const existing = new Set(
      services.map((service) => service.name.trim().toLowerCase()),
    );
    const missing = PRICE_LIST.filter(
      (entry) => !existing.has(entry.name.trim().toLowerCase()),
    );
    if (missing.length === 0) {
      addToast({ title: "Price list already loaded", color: "warning" });
      return;
    }
    setImporting(true);
    try {
      for (const entry of missing) {
        await createService.mutateAsync({
          name: entry.name,
          price: entry.price,
          priceUsd: entry.priceUsd,
          category: entry.category,
        });
      }
      addToast({
        title: `Added ${missing.length} service${missing.length > 1 ? "s" : ""}`,
        color: "success",
      });
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Services</h2>
          <p className="text-sm text-slate-500">
            Manage salon services and pricing.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void loadPriceList()}
            disabled={importing}
            className="flex items-center justify-center gap-2 rounded-lg border bg-white px-4 py-2.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-40"
          >
            <Download className="size-4" /> Load price list
          </button>
          <button
            type="button"
            onClick={openAdd}
            className="flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white"
          >
            <Plus className="size-4" /> Add service
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-3 size-4 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search services…"
          className="h-10 w-full rounded-lg border bg-white pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-slate-900"
        />
      </div>

      <div className="overflow-hidden rounded-xl border bg-white shadow-card">
        <div className="grid grid-cols-[1fr_120px_120px] border-b bg-slate-50 px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
          <div>Service</div>
          <div>Price</div>
          <div />
        </div>

        {isLoading ? (
          <div className="divide-y">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="px-4 py-4">
                <div className="h-8 animate-pulse rounded bg-slate-100" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
            <div className="grid size-10 place-items-center rounded-full bg-slate-100">
              <Plus className="size-4" />
            </div>
            <p className="font-medium text-slate-500">
              {query ? "No matching services" : "No services yet"}
            </p>
            <p className="text-sm text-slate-500">
              {query
                ? "Try a different search."
                : "Add services to start recording sales."}
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {filtered.map((svc) => (
              <div
                key={svc.id}
                className="grid grid-cols-[1fr_120px_120px] items-center px-4 py-4"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{svc.name}</div>
                  <div className="text-xs text-slate-500">
                    {svc.category ?? "Active"}
                  </div>
                </div>
                <div className="text-sm">
                  <div><Money value={svc.price} /></div>
                  {svc.priceUsd !== undefined && (
                    <div className="text-xs text-slate-400">
                      <Money value={svc.priceUsd} currency="USD" />
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(svc)}
                    aria-label={`Edit ${svc.name}`}
                    className="grid size-8 place-items-center rounded-md border hover:bg-slate-50"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(svc.id)}
                    aria-label={`Delete ${svc.name}`}
                    className="grid size-8 place-items-center rounded-md border text-red-500 hover:bg-red-50"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-lg rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b p-4">
              <h3 className="font-semibold">
                {editingId ? "Edit service" : "Add service"}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
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
                  placeholder="Haircut"
                  className="mt-1 h-10 w-full rounded-lg border px-3 text-sm outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Price (MVR)</label>
                <div className="relative mt-1">
                  <RufiyaaSign className="absolute left-3 top-3 size-4 text-slate-400" />
                  <input
                    type="number"
                    min="0"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="200"
                    className="h-10 w-full rounded-lg border pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">
                  Price (USD){" "}
                  <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-2.5 text-sm text-slate-400">
                    $
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={priceUsd}
                    onChange={(e) => setPriceUsd(e.target.value)}
                    placeholder="5"
                    className="h-10 w-full rounded-lg border pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Category</label>
                <input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Hair"
                  className="mt-1 h-10 w-full rounded-lg border px-3 text-sm outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t p-4">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40"
              >
                {editingId ? "Save" : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
