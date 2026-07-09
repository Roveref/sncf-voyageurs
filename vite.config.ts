/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

export default defineConfig(async ({ mode }) => {
  const seenIPs = new Set<string>();

  const connectionLogger = {
    name: "connection-logger",
    configureServer(server: any) {
      server.middlewares.use((req: any, _res: any, next: any) => {
        const ip = req.socket.remoteAddress?.replace("::ffff:", "") || "unknown";
        if (!seenIPs.has(ip)) {
          seenIPs.add(ip);
          const time = new Date().toLocaleTimeString("fr-FR", { hour12: false });
          console.log(`[${time}] 🟢 New connection from ${ip}`);
        }
        next();
      });
    },
  };

  const plugins = [
    connectionLogger,
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "GAIF Pilot — SNCF Voyageurs",
        short_name: "GAIF Pilot",
        description: "Plateforme EAM de pilotage des installations fixes — Direction GAIF SNCF Voyageurs",
        theme_color: "#EB0070",
        background_color: "#FAF8F7",
        lang: "fr",
        display: "standalone",
        icons: [
          {
            src: "/favicon-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/favicon-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /\/api\/.*/,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60, // 1 hour
              },
            },
          },
        ],
      },
    }),
  ];

  // Bundle analyzer: run `ANALYZE=true npm run build` to generate report
  if (mode === "analyze" || process.env.ANALYZE) {
    const { visualizer } = await import("rollup-plugin-visualizer");
    plugins.push(
      visualizer({
        filename: "build/bundle-report.html",
        template: "treemap",
        gzipSize: true,
        open: true,
      })
    );
  }

  return {
    plugins,
    resolve: {
      alias: {
        src: path.resolve(__dirname, "src"),
        "@shared": path.resolve(__dirname, "shared"),
      },
    },
    server: {
      port: parseInt(process.env.VITE_PORT || "3000", 10),
      open: true,
      proxy: {
        "/api": {
          target: process.env.VITE_API_PROXY_TARGET || "http://localhost:3001",
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: "build",
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks: {
            "vendor-mui": ["@mui/material", "@mui/x-date-pickers"],
            "vendor-mui-icons": ["@mui/icons-material"],
            "vendor-charts": ["recharts"],
            "vendor-date": ["date-fns"],
            "vendor-xlsx": ["xlsx", "fflate"],
            "vendor-router": ["react-router-dom"],
          },
        },
      },
    },
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: ["src/test-setup.ts"],
      include: ["src/**/*.test.{ts,tsx}"],
      ui: true,
      open: false,
      reporters: ["verbose"],
      coverage: {
        provider: "v8",
        reporter: ["text", "lcov"],
        reportsDirectory: "./coverage",
      },
    },
  };
});
