import { type ComponentType, type ReactNode, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  ChevronsUpDown,
  Clock3,
  Hourglass,
  LayoutDashboard,
  LogOut,
  Plus,
  ReceiptText,
  Scissors,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";
import { SyncIndicator } from "@/components/sync-indicator";
import { SyncBanner } from "@/components/sync-banner";
import { SyncSettings } from "@/components/sync-settings";
import { canManageTeam, ROLE_LABELS, useAuth, type Session } from "@/hooks/use-auth";
import { canUseSalonTools, departmentLabel, useDepartments } from "@/hooks/use-departments";
import type { Department } from "@/models/types";
import { accountEmail, isSupabaseConfigured } from "@/supabase";
import { initial } from "@/utils/format";
import { COMPANY_NAME, SALON_NAME } from "@/brand";

type NavItem = {
  to: string;
  label: string;
  shortLabel: string;
  icon: ComponentType<{ className?: string }>;
  match: string;
  exact?: boolean;
  /** Only owners/admins see this item. */
  adminOnly?: boolean;
  /** Only staff who work in the salon (plus admins) see this item. */
  salonOnly?: boolean;
  /** Only salon *floor staff* see this item — hidden from owners/admins. */
  staffOnly?: boolean;
  /** Alternative label shown to owners/admins. */
  adminLabel?: string;
  /** Alternative label shown to staff who don't work in the salon. */
  otherLabel?: string;
};

const NAV: NavItem[] = [
  { to: "/", label: "Dashboard", shortLabel: "Home", icon: LayoutDashboard, match: "/", exact: true, adminLabel: "Admin Portal", otherLabel: "Staff Portal" },
  { to: "/sales/new", label: "New Sale", shortLabel: "Sale", icon: ShoppingBag, match: "/sales/new", staffOnly: true },
  { to: "/services", label: "Services", shortLabel: "Services", icon: Sparkles, match: "/services", adminOnly: true },
  { to: "/sales", label: "Sales", shortLabel: "Sales", icon: ReceiptText, match: "/sales", exact: true, salonOnly: true },
  { to: "/attendance", label: "Barber Time", shortLabel: "Time", icon: Clock3, match: "/attendance", adminLabel: "Attendance", otherLabel: "Attendance" },
  { to: "/payroll", label: "Salary", shortLabel: "Salary", icon: Wallet, match: "/payroll", adminLabel: "Payroll" },
  { to: "/admin", label: "Team", shortLabel: "Team", icon: ShieldCheck, match: "/admin", adminOnly: true },
];

const PAGE_TITLES: { match: string; title: string; exact?: boolean }[] = [
  { match: "/", title: "Dashboard", exact: true },
  { match: "/sales/new", title: "New Sale" },
  { match: "/sales", title: "Sales", exact: true },
  { match: "/services", title: "Services" },
  { match: "/attendance", title: "Barber Time" },
  { match: "/payroll", title: "Salary" },
  { match: "/barbers", title: "Staff" },
  { match: "/admin", title: "Team" },
];

function matches(pathname: string, item: { match: string; exact?: boolean }): boolean {
  return item.exact ? pathname === item.match : pathname.startsWith(item.match);
}

function pageTitle(pathname: string): string {
  return (
    PAGE_TITLES.find((entry) => matches(pathname, entry))?.title ?? COMPANY_NAME
  );
}

/**
 * The brand icon: scissors only for floor staff who work in the salon. Admins
 * and other-department staff get the neutral staff icon.
 */
function brandIcon(session: Session | null, departments: Department[]) {
  if (canManageTeam(session?.role)) return Users;
  return canUseSalonTools(session, departments) ? Scissors : Users;
}

/**
 * The header title follows the *visible* navigation, so it changes with the
 * signed-in audience (e.g. "Staff Portal" for non-salon staff) instead of
 * always showing "Dashboard".
 */
function headerTitle(
  session: Session | null,
  pathname: string,
  departments: Department[],
): string {
  const item = navFor(session, departments).find((entry) =>
    matches(pathname, entry),
  );
  return item?.label ?? pageTitle(pathname);
}

/** Navigation entries visible to the given role. */
function navFor(session: Session | null, departments: Department[]): NavItem[] {
  const admin = canManageTeam(session?.role);
  const salon = canUseSalonTools(session, departments);
  return NAV.filter((item) => {
    if (item.adminOnly) return admin;
    if (item.staffOnly) return salon && !admin;
    if (item.salonOnly) return salon;
    return true;
  }).map((item) => {
    if (item.adminLabel && admin) return { ...item, label: item.adminLabel };
    if (item.otherLabel && !salon) return { ...item, label: item.otherLabel };
    return item;
  });
}

export function RootLayout({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { session, ready } = useAuth();
  const [showSettings, setShowSettings] = useState(false);
  const [showAccount, setShowAccount] = useState(false);

  // The app shell (sidebar, header, page content) is only mounted for an
  // approved, signed-in user — otherwise the dashboard would render behind the
  // sign-in overlay.
  const signedIn = ready && session !== null && session.approved;
  const awaitingApproval = ready && session !== null && !session.approved;

  return (
    <div
      className={
        signedIn ? "min-h-screen md:grid md:grid-cols-[250px_1fr]" : "min-h-screen"
      }
    >
      {signedIn && (
        <>
          <Sidebar
            pathname={pathname}
            onOpenAccount={() => setShowAccount(true)}
          />

          <main className="min-w-0">
            <Topbar
              onOpenSettings={() => setShowSettings(true)}
              onOpenAccount={() => setShowAccount(true)}
            />
            <SyncBanner />
            <div className="mx-auto max-w-[1500px] p-4 pb-28 md:p-6 md:pb-10">
              {children}
            </div>
          </main>

          <MobileNav pathname={pathname} />
          <SyncSettings
            open={showSettings}
            onClose={() => setShowSettings(false)}
          />
          {showAccount && <AccountModal onClose={() => setShowAccount(false)} />}
        </>
      )}

      {!ready && (
        <div className="grid min-h-screen place-items-center">
          <div className="size-6 animate-pulse rounded-full bg-slate-200" />
        </div>
      )}
      {ready && !session && <AuthGate />}
      {awaitingApproval && <PendingApproval />}
    </div>
  );
}

function Sidebar({
  pathname,
  onOpenAccount,
}: {
  pathname: string;
  onOpenAccount: () => void;
}) {
  const { session } = useAuth();
  const departments = useDepartments();
  // The scissors is salon-floor branding; admins and other staff get a neutral icon.
  const BrandIcon = brandIcon(session, departments);

  return (
    <aside className="hidden flex-col border-r bg-white px-4 py-5 md:flex">
      <div className="flex items-center gap-3 px-2">
        <div className="grid size-10 place-items-center rounded-xl bg-slate-950 text-white">
          <BrandIcon className="size-5" />
        </div>
        <div>
          <div className="font-bold tracking-tight">{COMPANY_NAME}</div>
          <div className="text-xs text-slate-500">
            {canUseSalonTools(session, departments) ? "Management Portal" : "Staff Portal"}
          </div>
        </div>
      </div>

      <nav className="mt-8 space-y-1">
        {navFor(session, departments).map((item) => {
          const active = matches(pathname, item);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active ? "nav-active" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={onOpenAccount}
        className="mt-auto rounded-xl border bg-slate-50 p-3 text-left transition-colors hover:bg-slate-100"
      >
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-full bg-slate-900 text-sm font-semibold text-white">
            {initial(session?.name ?? "?")}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">
              {session?.name ?? "Guest"}
            </div>
            <div className="truncate text-xs text-slate-500">
              {session ? ROLE_LABELS[session.role] : "Not signed in"}
            </div>
          </div>
          <ChevronsUpDown className="ml-auto size-4 text-slate-400" />
        </div>
      </button>
    </aside>
  );
}

function Topbar({
  onOpenSettings,
  onOpenAccount,
}: {
  onOpenSettings: () => void;
  onOpenAccount: () => void;
}) {
  const { session } = useAuth();
  const departments = useDepartments();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const title = headerTitle(session, pathname, departments);
  const BrandIcon = brandIcon(session, departments);
  // Admins monitor sales rather than ringing them up, so they don't get "New Sale".
  const showNewSale =
    canUseSalonTools(session, departments) && !canManageTeam(session?.role);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-white/95 px-4 backdrop-blur md:px-6">
      <div className="flex items-center gap-3">
        <div className="grid size-9 place-items-center rounded-lg bg-slate-950 text-white md:hidden">
          <BrandIcon className="size-4" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">{title}</h1>
          <p className="truncate text-xs text-slate-500">
            {canUseSalonTools(session, departments)
              ? SALON_NAME
              : departmentLabel(departments, session?.department)}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden sm:block">
          <SyncIndicator />
        </div>
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Settings"
          className="grid size-9 place-items-center rounded-lg border bg-white hover:bg-slate-50"
        >
          <Settings className="size-4" />
        </button>
        <button
          type="button"
          aria-label="Notifications"
          className="grid size-9 place-items-center rounded-lg border bg-white hover:bg-slate-50"
        >
          <Bell className="size-4" />
        </button>
        <Link
          to="/sales/new"
          className={`items-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-sm font-medium text-white ${
            showNewSale ? "hidden sm:flex" : "hidden"
          }`}
        >
          <Plus className="size-4" /> New Sale
        </Link>
        <button
          type="button"
          onClick={onOpenAccount}
          aria-label="Account and sign out"
          className="grid size-9 shrink-0 place-items-center rounded-full bg-slate-900 text-xs font-semibold text-white"
        >
          {initial(session?.name ?? "?")}
        </button>
      </div>
    </header>
  );
}

function MobileNav({ pathname }: { pathname: string }) {
  const { session } = useAuth();
  const departments = useDepartments();
  const items = navFor(session, departments);
  // With many items the bar scrolls horizontally rather than crushing the labels.
  const scrollable = items.length > 5;
  return (
    <nav
      style={
        scrollable
          ? undefined
          : { gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }
      }
      className={`fixed inset-x-0 bottom-0 z-30 border-t bg-white px-1 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 md:hidden ${
        scrollable ? "flex gap-1 overflow-x-auto" : "grid"
      }`}
      aria-label="Primary"
    >
      {items.map((item) => {
        const active = matches(pathname, item);
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            className={`flex flex-col items-center gap-1 text-[10px] font-medium ${
              scrollable ? "min-w-[68px] flex-1" : ""
            } ${active ? "text-slate-900" : "text-slate-500"}`}
          >
            <Icon className="size-5" />
            {item.shortLabel}
          </Link>
        );
      })}
    </nav>
  );
}

type AuthMode = "signin" | "create";

/** Blocks the app until a barber signs in with a mobile number + PIN. */
function AuthGate() {
  const { signIn, register } = useAuth();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [mobile, setMobile] = useState("");
  const [name, setName] = useState("");
  const [pin, setPinValue] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const creating = mode === "create";

  async function submit() {
    setError("");
    if (creating && pin !== confirm) {
      setError("PINs do not match");
      return;
    }
    setBusy(true);
    try {
      const result = creating
        ? await register({ name, mobile, pin })
        : await signIn(mobile, pin);
      if (!result.ok) setError(result.error ?? "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  function toggleMode() {
    setError("");
    setMode(creating ? "signin" : "create");
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
        <div className="grid size-11 place-items-center rounded-xl bg-slate-950 text-white">
          <Scissors className="size-5" />
        </div>
        <h2 className="mt-4 text-xl font-bold">
          {creating ? "Create your account" : `Sign in to ${COMPANY_NAME}`}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {creating
            ? "Set up your barber account with a mobile number and 6-digit PIN."
            : "Sign in with your mobile number (or email) and PIN."}
        </p>

        {!isSupabaseConfigured && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Local-only mode — no backend is configured, so sign-in is by mobile
            number and PIN on this device. Email sign-in needs Supabase.
          </p>
        )}

        <div className="mt-5 space-y-3">
          {creating && (
            <Field label="Your name">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Naish"
                className="h-10 w-full rounded-lg border px-3 text-sm outline-none focus:ring-2 focus:ring-slate-900"
              />
            </Field>
          )}

          <Field label="Mobile number or email">
            <input
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              autoFocus={!creating}
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              placeholder="7XXXXXX or name@example.com"
              className="h-10 w-full rounded-lg border px-3 text-sm outline-none focus:ring-2 focus:ring-slate-900"
            />
            {mobile.trim().length > 0 && (
              <span className="mt-1 block text-xs font-normal text-slate-400">
                Account: {accountEmail(mobile)}
              </span>
            )}
          </Field>

          <Field label="PIN">
            <PinInput
              value={pin}
              onChange={setPinValue}
              onEnter={() => void submit()}
            />
          </Field>

          {creating && (
            <Field label="Confirm PIN">
              <PinInput
                value={confirm}
                onChange={setConfirm}
                onEnter={() => void submit()}
              />
            </Field>
          )}
        </div>

        {error && <p className="mt-3 text-xs text-rose-600">{error}</p>}

        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy}
          className="mt-4 w-full rounded-lg bg-slate-950 px-4 py-3 text-sm font-medium text-white disabled:opacity-40"
        >
          {busy ? "Please wait…" : creating ? "Create account" : "Sign in"}
        </button>

        <button
          type="button"
          onClick={toggleMode}
          className="mt-2 w-full text-center text-xs font-medium text-slate-500 hover:text-slate-700"
        >
          {creating
            ? "Already have an account? Sign in"
            : "New here? Create an account"}
        </button>
      </div>
    </div>
  );
}

function PendingApproval() {
  const { session, signOut, refresh } = useAuth();
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 text-center shadow-2xl">
        <div className="mx-auto grid size-11 place-items-center rounded-xl bg-amber-100 text-amber-700">
          <Hourglass className="size-5" />
        </div>
        <h2 className="mt-4 text-xl font-bold">Awaiting approval</h2>
        <p className="mt-1 text-sm text-slate-500">
          {session?.name ? `Hi ${session.name}, ` : ""}
          your account is waiting for an admin to approve it. This screen updates
          automatically.
        </p>
        <button
          type="button"
          onClick={() => void refresh()}
          className="mt-4 w-full rounded-lg bg-slate-950 px-4 py-3 text-sm font-medium text-white"
        >
          Check again
        </button>
        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-2 w-full rounded-lg px-4 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-100"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

function AccountModal({ onClose }: { onClose: () => void }) {
  const { session, signOut, updateName } = useAuth();
  const [name, setName] = useState(session?.name ?? "");
  const [saving, setSaving] = useState(false);

  if (!session) return null;

  async function saveName() {
    setSaving(true);
    try {
      await updateName(name);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-sm rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-full bg-slate-900 text-sm font-semibold text-white">
            {initial(session.name)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate font-semibold">{session.name}</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                {ROLE_LABELS[session.role]}
              </span>
            </div>
            <div className="truncate text-sm text-slate-500">
              {session.mobile}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <Field label="Display name">
            <div className="flex gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-10 w-full rounded-lg border px-3 text-sm outline-none focus:ring-2 focus:ring-slate-900"
              />
              <button
                type="button"
                onClick={() => void saveName()}
                disabled={saving || !name.trim() || name.trim() === session.name}
                className="shrink-0 rounded-lg bg-slate-950 px-4 text-sm font-medium text-white disabled:opacity-40"
              >
                Save
              </button>
            </div>
          </Field>
        </div>

        <button
          type="button"
          onClick={() => {
            signOut();
            onClose();
          }}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-rose-200 px-4 py-3 text-sm font-medium text-rose-700 hover:bg-rose-50"
        >
          <LogOut className="size-4" /> Sign out
        </button>
        <button
          type="button"
          onClick={onClose}
          className="mt-2 w-full rounded-lg px-4 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-100"
        >
          Close
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

function PinInput({
  value,
  onChange,
  onEnter,
}: {
  value: string;
  onChange: (value: string) => void;
  onEnter?: () => void;
}) {
  return (
    <input
      type="password"
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={6}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
      onKeyDown={(e) => {
        if (e.key === "Enter" && onEnter) onEnter();
      }}
      placeholder="••••"
      className="h-10 w-full rounded-lg border px-3 text-sm tracking-[0.3em] outline-none focus:ring-2 focus:ring-slate-900"
    />
  );
}
