import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HeroUIProvider, ToastProvider } from "@heroui/react";
import { AuthProvider } from "@/hooks/use-auth";
import { syncEngine } from "@/sync/engine";
import { seedIfEmpty } from "@/db/dexie";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data lives in Dexie, so keep the query cache fresh but stable.
      staleTime: 5_000,
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

export function AppProviders({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void seedIfEmpty();
    syncEngine.start();
    return () => syncEngine.stop();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <HeroUIProvider>
        <ToastProvider placement="top-center" />
        <AuthProvider>{children}</AuthProvider>
      </HeroUIProvider>
    </QueryClientProvider>
  );
}
