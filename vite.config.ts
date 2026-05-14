import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  appType: "spa",
  base: "/",
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    middlewareMode: false,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "robots.txt",
        "pwa-192.svg",
        "pwa-512.svg",
        "logo-64x64.png",
        "logo-96x96.png",
        "logo-128x128.png",
        "logo-192x192.png",
        "logo-256x256.png",
        "logo-384x384.png",
        "logo-512x512.png"
      ],
      manifest: {
        name: "Lhoxtencer",
        short_name: "Lhoxtencer",
        description: "Gestion hôtelière sur desktop, mobile et tablette.",
        theme_color: "#0f172a",
        background_color: "#f8fafc",
        display: "standalone",
        start_url: "./",
        scope: "./",
        icons: [
          {
            src: "logo-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "logo-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,json}"],
        navigateFallback: "index.html",
        // CRITICAL FIX: Prevent service worker from serving index.html for assets
        // Only serve index.html for actual navigation routes (like /guests, /guests/123)
        // But NOT for static files (JS, CSS, images, manifest, etc.)
        navigateFallbackDenylist: [
          /^\/assets\//,        // Exclude /assets/* - these are bundled JS/CSS
          /^\/api\//,           // Exclude API calls
          /\.js$/,              // Exclude all JS files
          /\.css$/,             // Exclude all CSS files
          /\.svg$/,             // Exclude all SVG files
          /\.json$/,            // Exclude all JSON files
          /\.webmanifest$/,     // Exclude web app manifest
          /\.woff2?$/,          // Exclude font files
          /\.png$/,             // Exclude PNG images
          /\.ico$/,             // Exclude favicon
        ],
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "http-cache",
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 86400 * 3,
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: true,
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));