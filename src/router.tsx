import {
  createRootRoute,
  createRoute,
  createHashHistory,
  createRouter,
  Outlet,
} from "@tanstack/react-router";
import { RootLayout } from "@/components/app-shell";
import { AdminOnly, SalonOnly } from "@/components/guards";
import { DashboardRoute } from "@/routes/dashboard";
import { SalesRoute } from "@/routes/sales";
import { NewSaleRoute } from "@/routes/new-sale";
import { ServicesRoute } from "@/routes/services";
import { BarbersRoute } from "@/routes/barbers";
import { AdminRoute } from "@/routes/admin";
import { AttendanceRoute } from "@/routes/attendance";
import { PayrollRoute } from "@/routes/payroll";
import { CalendarRoute } from "@/routes/calendar";
import { ProfileRoute } from "@/routes/profile";

// Hash history keeps the PWA working offline without a server fallback route.
const hashHistory = createHashHistory();

const rootRoute = createRootRoute({
  component: () => (
    <RootLayout>
      <Outlet />
    </RootLayout>
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: DashboardRoute,
});

const salesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sales",
  component: () => (
    <SalonOnly>
      <SalesRoute />
    </SalonOnly>
  ),
});

const newSaleRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sales/new",
  component: () => (
    <SalonOnly>
      <NewSaleRoute />
    </SalonOnly>
  ),
});

const servicesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/services",
  component: () => (
    <AdminOnly>
      <ServicesRoute />
    </AdminOnly>
  ),
});

const barbersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/barbers",
  component: () => (
    <AdminOnly>
      <BarbersRoute />
    </AdminOnly>
  ),
});

const attendanceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/attendance",
  component: AttendanceRoute,
});

const payrollRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/payroll",
  component: PayrollRoute,
});

const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin",
  component: () => (
    <AdminOnly>
      <AdminRoute />
    </AdminOnly>
  ),
});

const calendarRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/calendar",
  component: CalendarRoute,
});

const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/profile",
  component: ProfileRoute,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  salesRoute,
  newSaleRoute,
  servicesRoute,
  barbersRoute,
  attendanceRoute,
  payrollRoute,
  adminRoute,
  calendarRoute,
  profileRoute,
]);

export const router = createRouter({
  routeTree,
  history: hashHistory,
  defaultPreload: "intent",
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
