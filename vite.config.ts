import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  // Read every env var (empty prefix) so the client can also accept the plain
  // `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` names, not just `VITE_*`.
  const env = loadEnv(mode, process.cwd(), "");

  const publicUrl =
    env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || "";

  const publicKey =
    env.VITE_SUPABASE_ANON_KEY ||
    env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    env.SUPABASE_PUBLISHABLE_KEY ||
    "";

  return {
    // Vite only exposes prefixed vars to the browser; `NEXT_PUBLIC_` is added so
    // Next-style names work too (see the `define` block for the plain names).
    envPrefix: ["VITE_", "NEXT_PUBLIC_"],

    // Only the public URL + publishable key are injected. Never the secret key.
    define: {
      __SUPABASE_URL__: JSON.stringify(publicUrl),
      __SUPABASE_ANON_KEY__: JSON.stringify(publicKey),
    },

    server: {
      port: 3000,
      strictPort: true,
    },
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    plugins: [
      react(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["favicon.svg", "robots.txt"],
        manifest: {
          name: "VinHolding",
          short_name: "VinHolding",
          description: "VinHolding staff portal — sales, attendance and payroll.",
          theme_color: "#ffffff",
          background_color: "#f8fafc",
          display: "standalone",
          orientation: "portrait",
          scope: "/",
          start_url: "/",
          icons: [
            {
              src: "favicon.svg",
              sizes: "any",
              type: "image/svg+xml",
              purpose: "any maskable",
            },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
          // Allow runtime caching of the remote sync API when implemented.
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/.*\/api\/.*/i,
              handler: "NetworkFirst",
              options: {
                cacheName: "api-cache",
                networkTimeoutSeconds: 10,
              },
            },
          ],
        },
      }),
    ],
  };
});
