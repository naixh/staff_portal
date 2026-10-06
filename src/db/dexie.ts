import Dexie, { type Table } from "dexie";
import { PRICE_LIST } from "@/data/price-list";
import type {
  Attendance,
  Barber,
  Sale,
  Service,
  SyncQueueEntry,
  SyncTable,
} from "@/models/types";
import { uid } from "@/utils/id";

export interface MetaRecord {
  key: string;
  value: unknown;
}

/**
 * The local NoSQL database (IndexedDB via Dexie).
 *
 * Everything the app needs to function offline lives here. Read queries hit
 * these tables directly; writes append to `syncQueue` for later upload.
 */
export class SalonDB extends Dexie {
  sales!: Table<Sale, string>;
  services!: Table<Service, string>;
  barbers!: Table<Barber, string>;
  attendance!: Table<Attendance, string>;
  syncQueue!: Table<SyncQueueEntry, string>;
  meta!: Table<MetaRecord, string>;

  constructor() {
    super("saloon-db");
    this.version(1).stores({
      // Primary key first, then secondary indexes.
      sales: "id, barberId, soldAt, updatedAt, deleted",
      services: "id, name, category, updatedAt, deleted",
      barbers: "id, name, updatedAt, deleted",
      syncQueue: "id, table, createdAt, attempts",
      meta: "key",
    });
    // v2 adds attendance records.
    this.version(2).stores({
      attendance: "id, barberId, date, updatedAt, deleted",
    });
  }
}

export const db = new SalonDB();

/** Map a sync table name to its Dexie table. */
export function tableFor(table: SyncTable): Table<unknown, string> {
  return db[table] as unknown as Table<unknown, string>;
}

/**
 * Wipe the local IndexedDB cache and reload. Data is re-pulled from Supabase on
 * the next launch — use this to clear stale local-only records.
 */
export async function resetLocalData(): Promise<void> {
  await db.delete();
  location.reload();
}

/** Seed the salon price list on first run so the app is usable immediately. */
export async function seedIfEmpty(): Promise<void> {
  const serviceCount = await db.services.count();

  const now = Date.now();

  if (serviceCount === 0) {
    const defaults: Service[] = PRICE_LIST.map((entry) => ({
      ...entry,
      id: uid(),
      deleted: false,
      createdAt: now,
      updatedAt: now,
    }));
    await db.services.bulkAdd(defaults);
  }
}
