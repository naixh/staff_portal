// Shared domain types for the salon sales domain.

export type ID = string;

/** A payment method id. The concrete list is configurable (see Team settings). */
export type PaymentMethod = string;

/** The currencies the salon bills in. */
export type Currency = "MVR" | "USD";

export const CURRENCIES: Currency[] = ["MVR", "USD"];

/** One configurable payment option, e.g. { id: "cash", label: "Cash" }. */
export interface PaymentMethodOption {
  id: string;
  label: string;
}

/** A salon service offered, e.g. "Haircut", "Beard trim". */
export interface Service {
  id: ID;
  name: string;
  /** Price in MVR. */
  price: number;
  /** Optional price in USD (set on the Services page). */
  priceUsd?: number;
  /** Optional category for grouping. */
  category?: string;
  /** Soft delete flag — kept for sync reconciliation. */
  deleted: boolean;
  updatedAt: number;
  createdAt: number;
}

/** A single sale line within a sale. */
export interface SaleItem {
  serviceId: ID;
  serviceName: string;
  price: number;
  quantity: number;
}

/** A completed sale / transaction. */
export interface Sale {
  id: ID;
  items: SaleItem[];
  /** Grand total charged, inclusive of any tip. */
  total: number;
  /** Optional tip added on top of the service subtotal. */
  tips?: number;
  barberId: ID;
  barberName: string;
  paymentMethod: PaymentMethod;
  /** Currency the sale was billed in (defaults to MVR). */
  currency?: Currency;
  /** ISO timestamp of when the sale happened. */
  soldAt: string;
  /** Epoch ms of the most recent correction, if the sale was edited. */
  editedAt?: number;
  /** The values as they were just before the most recent edit. */
  previous?: SaleSnapshot;
  deleted: boolean;
  updatedAt: number;
  createdAt: number;
}

/** A sale's values before a correction, kept so the change can be reviewed. */
export interface SaleSnapshot {
  items: SaleItem[];
  total: number;
  tips?: number;
  paymentMethod: PaymentMethod;
  currency?: Currency;
}

/** A barber / staff member. Also doubles as the device account for sign-in. */
export interface Barber {
  id: ID;
  name: string;
  /** Mobile number used to sign in. */
  phone?: string;
  /** Salted SHA-256 hash of the account PIN (never the PIN itself). */
  pinHash?: string;
  /** Allowed break time per day, in minutes (set on the Staff page). */
  breakMinutes?: number;
  deleted: boolean;
  updatedAt: number;
  createdAt: number;
}

export type SyncTable = "sales" | "services" | "barbers" | "attendance";

/** Why a staff member is not working on a given day. */
export type LeaveStatus = "leave" | "sick";

/** A barber's clock-in/out record for a single day. */
export interface Attendance {
  id: ID;
  barberId: ID;
  barberName: string;
  /** Local date, formatted YYYY-MM-DD. */
  date: string;
  /** Clock-in time (HH:MM) or null. */
  clockIn: string | null;
  /** Clock-out time (HH:MM) or null. */
  clockOut: string | null;
  /** Break start time (HH:MM) or null. */
  breakStart?: string | null;
  /** Break end time (HH:MM) or null. */
  breakEnd?: string | null;
  /** Set when the staff member is marked absent for the day (leave/sick). */
  status?: LeaveStatus;
  deleted: boolean;
  updatedAt: number;
  createdAt: number;
}

/**
 * A staff department. Departments are configurable (see the Team page) and each
 * declares whether its staff get the salon sales tools.
 */
export interface Department {
  id: string;
  label: string;
  /** Staff in this department see sales, services and new sales. */
  salonTools: boolean;
}

/** A department id stored on a profile (matches a configured {@link Department}). */
export type StaffType = string;

export type PayrollStatus = "pending" | "signed";

/** A salary payment run for one staff member for one period. */
export interface PayrollPayment {
  id: ID;
  staffId: ID;
  /** Payroll period as YYYY-MM. */
  period: string;
  salary: number;
  food: number;
  bonus: number;
  deductions: number;
  /** salary + food + bonus − deductions (computed in the database). */
  total: number;
  note: string | null;
  status: PayrollStatus;
  /** Acknowledging signature (PNG data URL) drawn by the staff member. */
  staffSignature: string | null;
  staffSignedAt: string | null;
  /** Approving signature (PNG data URL) drawn by the admin. */
  adminSignature: string | null;
  adminSignedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Default payroll amounts configured on a staff profile. */
export interface PayrollDefaults {
  salary: number;
  food: number;
  bonus: number;
}

export type SyncOperation = "create" | "update" | "delete";

/** An entry in the local outbox queue awaiting push to the server. */
export interface SyncQueueEntry {
  id: ID;
  table: SyncTable;
  operation: SyncOperation;
  recordId: ID;
  payload: unknown;
  createdAt: number;
  /** Number of failed push attempts — used for backoff. */
  attempts: number;
  /** Timestamp before which the next push attempt should be skipped (backoff). */
  nextAttemptAt?: number;
  /** Last error message, if any. */
  lastError?: string;
}
