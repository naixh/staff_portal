/**
 * Local CRUD API over Dexie/IndexedDB.
 *
 * This is the only write path the UI uses. Each mutation:
 *   1. writes the record to the local table,
 *   2. appends an entry to `syncQueue` so the sync engine can ship it later.
 *
 * Because reads/writes are local, the app is fully functional offline.
 */
import { db, tableFor } from "@/db/dexie";
import type {
  Attendance,
  Barber,
  LeaveStatus,
  Sale,
  Service,
  SyncOperation,
  SyncQueueEntry,
  SyncTable,
} from "@/models/types";
import { uid } from "@/utils/id";

async function enqueue(
  table: SyncTable,
  operation: SyncOperation,
  recordId: string,
  payload: unknown,
): Promise<void> {
  const entry: SyncQueueEntry = {
    id: uid(),
    table,
    operation,
    recordId,
    payload,
    createdAt: Date.now(),
    attempts: 0,
  };
  await db.syncQueue.add(entry);
}

// ──────────────────────────────────────────────────────────────────────
// Services
// ──────────────────────────────────────────────────────────────────────

export async function listServices(): Promise<Service[]> {
  return db.services.where("deleted").equals(0 as never).toArray() as Promise<Service[]>;
}

export async function getActiveServices(): Promise<Service[]> {
  const all = await db.services.toArray();
  return all.filter((s) => !s.deleted);
}

export async function createService(
  input: Pick<Service, "name" | "price" | "category" | "priceUsd">,
): Promise<Service> {
  const now = Date.now();
  const record: Service = {
    id: uid(),
    name: input.name,
    price: input.price,
    priceUsd: input.priceUsd,
    category: input.category,
    deleted: false,
    createdAt: now,
    updatedAt: now,
  };
  await db.services.add(record);
  await enqueue("services", "create", record.id, record);
  return record;
}

export async function updateService(
  id: string,
  patch: Partial<Pick<Service, "name" | "price" | "category" | "priceUsd">>,
): Promise<void> {
  const existing = await db.services.get(id);
  if (!existing) return;
  const updated: Service = { ...existing, ...patch, updatedAt: Date.now() };
  await db.services.put(updated);
  await enqueue("services", "update", id, updated);
}

export async function deleteService(id: string): Promise<void> {
  const existing = await db.services.get(id);
  if (!existing) return;
  const updated: Service = { ...existing, deleted: true, updatedAt: Date.now() };
  await db.services.put(updated);
  await enqueue("services", "delete", id, updated);
}

// ──────────────────────────────────────────────────────────────────────
// Barbers
// ──────────────────────────────────────────────────────────────────────

export async function getActiveBarbers(): Promise<Barber[]> {
  const all = await db.barbers.toArray();
  return all.filter((b) => !b.deleted);
}

export async function listBarbers(): Promise<Barber[]> {
  return db.barbers.toArray();
}

export interface BarberInput {
  /** Explicit id — used to align a barber with a Supabase auth user. */
  id?: string;
  name: string;
  phone?: string;
  pinHash?: string;
  breakMinutes?: number;
}

/** Find a barber by id. */
export async function getBarberById(id: string): Promise<Barber | undefined> {
  return db.barbers.get(id);
}

/** Find a (non-deleted) barber by their sign-in mobile number. */
export async function getBarberByPhone(phone: string): Promise<Barber | undefined> {
  const all = await db.barbers.toArray();
  return all.find((b) => !b.deleted && b.phone === phone);
}

export async function createBarber(input: BarberInput): Promise<Barber> {
  const now = Date.now();
  const record: Barber = {
    id: input.id ?? uid(),
    name: input.name,
    phone: input.phone,
    pinHash: input.pinHash,
    breakMinutes: input.breakMinutes,
    deleted: false,
    createdAt: now,
    updatedAt: now,
  };
  await db.barbers.add(record);
  await enqueue("barbers", "create", record.id, record);
  return record;
}

export async function updateBarber(
  id: string,
  patch: Partial<Pick<Barber, "name" | "phone" | "pinHash" | "breakMinutes" | "deleted">>,
): Promise<void> {
  const existing = await db.barbers.get(id);
  if (!existing) return;
  const updated: Barber = { ...existing, ...patch, updatedAt: Date.now() };
  await db.barbers.put(updated);
  await enqueue("barbers", "update", id, updated);
}

export async function deleteBarber(id: string): Promise<void> {
  const existing = await db.barbers.get(id);
  if (!existing) return;
  const updated: Barber = { ...existing, deleted: true, updatedAt: Date.now() };
  await db.barbers.put(updated);
  await enqueue("barbers", "delete", id, updated);
}

// ──────────────────────────────────────────────────────────────────────
// Sales
// ──────────────────────────────────────────────────────────────────────

export async function listSales(): Promise<Sale[]> {
  const all = await db.sales.toArray();
  return all
    .filter((s) => !s.deleted)
    .sort((a, b) => (a.soldAt < b.soldAt ? 1 : -1));
}

export async function createSale(input: Omit<Sale, "id" | "deleted" | "updatedAt" | "createdAt">): Promise<Sale> {
  const now = Date.now();
  const record: Sale = {
    ...input,
    id: uid(),
    deleted: false,
    createdAt: now,
    updatedAt: now,
  };
  await db.sales.add(record);
  await enqueue("sales", "create", record.id, record);
  return record;
}

export async function deleteSale(id: string): Promise<void> {
  const existing = await db.sales.get(id);
  if (!existing) return;
  const updated: Sale = { ...existing, deleted: true, updatedAt: Date.now() };
  await db.sales.put(updated);
  await enqueue("sales", "delete", id, updated);
}

/**
 * Correct a recorded sale. The values before the change are kept on
 * `sale.previous` so the original figure can be shown and the edit reviewed.
 */
export async function updateSale(
  id: string,
  patch: Partial<Pick<Sale, "items" | "total" | "tips" | "paymentMethod">>,
): Promise<void> {
  const existing = await db.sales.get(id);
  if (!existing) return;
  const now = Date.now();
  const updated: Sale = {
    ...existing,
    ...patch,
    previous: {
      items: existing.items,
      total: existing.total,
      tips: existing.tips,
      paymentMethod: existing.paymentMethod,
    },
    editedAt: now,
    updatedAt: now,
  };
  await db.sales.put(updated);
  await enqueue("sales", "update", id, updated);
}

// ──────────────────────────────────────────────────────────────────────
// Attendance
// ──────────────────────────────────────────────────────────────────────

/** Local calendar date as YYYY-MM-DD. */
export function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function nowTime(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

/** All non-deleted attendance records, newest day first. */
export async function listAttendance(): Promise<Attendance[]> {
  const all = await db.attendance.toArray();
  return all
    .filter((record) => !record.deleted)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

/** A clock action recorded against a barber for today. */
export type ClockAction = "in" | "out" | "break-start" | "break-end";

/** Clock a barber in/out (or start/end a break) for today. */
export async function recordClock(
  barberId: string,
  barberName: string,
  action: ClockAction,
): Promise<void> {
  const date = localDateKey();
  const existing = (await db.attendance.where("barberId").equals(barberId).toArray()).find(
    (record) => !record.deleted && record.date === date,
  );
  const time = nowTime();
  const now = Date.now();

  if (!existing) {
    const record: Attendance = {
      id: uid(),
      barberId,
      barberName,
      date,
      clockIn: action === "in" ? time : null,
      clockOut: action === "out" ? time : null,
      breakStart: action === "break-start" ? time : null,
      breakEnd: action === "break-end" ? time : null,
      deleted: false,
      createdAt: now,
      updatedAt: now,
    };
    await db.attendance.add(record);
    await enqueue("attendance", "create", record.id, record);
    return;
  }

  const updated: Attendance = { ...existing, barberName, updatedAt: now };
  switch (action) {
    case "in":
      updated.clockIn = time;
      updated.clockOut = null;
      updated.breakStart = null;
      updated.breakEnd = null;
      // Showing up clears any leave/sick marking for the day.
      updated.status = undefined;
      break;
    case "out":
      updated.clockOut = time;
      // Ending the shift while still on a break closes the break.
      if (updated.breakStart && !updated.breakEnd) updated.breakEnd = time;
      break;
    case "break-start":
      updated.breakStart = time;
      updated.breakEnd = null;
      break;
    case "break-end":
      updated.breakEnd = time;
      break;
  }
  await db.attendance.put(updated);
  await enqueue("attendance", "update", updated.id, updated);
}

/**
 * Mark (or clear) a staff member's leave/sick status for today.
 *
 * `null` clears it. A cleared record that has no clock times is soft-deleted so
 * the day doesn't keep an empty attendance row.
 */
export async function setLeaveStatus(
  barberId: string,
  barberName: string,
  status: LeaveStatus | null,
): Promise<void> {
  const date = localDateKey();
  const existing = (await db.attendance.where("barberId").equals(barberId).toArray()).find(
    (record) => !record.deleted && record.date === date,
  );
  const now = Date.now();

  if (!existing) {
    if (!status) return;
    const record: Attendance = {
      id: uid(),
      barberId,
      barberName,
      date,
      clockIn: null,
      clockOut: null,
      status,
      deleted: false,
      createdAt: now,
      updatedAt: now,
    };
    await db.attendance.add(record);
    await enqueue("attendance", "create", record.id, record);
    return;
  }

  if (!status && !existing.clockIn && !existing.clockOut) {
    const removed: Attendance = { ...existing, deleted: true, updatedAt: now };
    await db.attendance.put(removed);
    await enqueue("attendance", "delete", removed.id, removed);
    return;
  }

  const updated: Attendance = {
    ...existing,
    barberName,
    status: status ?? undefined,
    updatedAt: now,
  };
  await db.attendance.put(updated);
  await enqueue("attendance", "update", updated.id, updated);
}

// ──────────────────────────────────────────────────────────────────────
// Apply remote records (used by the pull side of the sync engine)
// ──────────────────────────────────────────────────────────────────────

/** Upsert a remote record using last-write-wins on `updatedAt`. */
export async function applyRemoteRecord(
  table: SyncTable,
  remote: { id: string; updatedAt: number; deleted?: boolean } & Record<string, unknown>,
): Promise<void> {
  const t = tableFor(table);
  const local = (await t.get(remote.id)) as
    | { id: string; updatedAt: number; deleted?: boolean }
    | undefined;

  if (local && local.updatedAt >= remote.updatedAt) {
    // Local is newer or equal — keep local (last-write-wins).
    return;
  }
  await t.put(remote as never);
}

/** Clear pushed entries from the outbox. */
export async function dequeue(ids: string[]): Promise<void> {
  await db.syncQueue.bulkDelete(ids);
}

/** Bump attempt count / store the last error for an entry. */
export async function markQueueFailure(
  id: string,
  error: string,
  nextAttemptAt?: number,
): Promise<void> {
  const entry = await db.syncQueue.get(id);
  if (!entry) return;
  await db.syncQueue.put({
    ...entry,
    attempts: entry.attempts + 1,
    lastError: error,
    nextAttemptAt,
  });
}

/**
 * Clear the failure state of queued entries so a manual retry attempts every
 * change again immediately (ignoring any pending backoff window).
 */
export async function resetQueueAttempts(ids?: string[]): Promise<void> {
  const entries = ids
    ? (await db.syncQueue.bulkGet(ids)).filter(
        (entry): entry is SyncQueueEntry => entry !== undefined,
      )
    : await db.syncQueue.toArray();
  if (entries.length === 0) return;
  await db.syncQueue.bulkPut(
    entries.map((entry) => ({
      ...entry,
      attempts: 0,
      lastError: undefined,
      nextAttemptAt: undefined,
    })),
  );
}

export async function pendingCount(): Promise<number> {
  return db.syncQueue.count();
}
