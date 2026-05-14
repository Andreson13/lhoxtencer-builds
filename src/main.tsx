import { createRoot } from "react-dom/client";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import { queryClient, queryPersister, queryPersistMaxAge } from "./lib/queryClient";
import "./index.css";

const isElectron = !!(window as any).electronApp?.isDesktop;

if (import.meta.env.PROD && !isElectron) {
	console.log("🔄 Registering Service Worker for auto-updates...");
	registerSW({
		immediate: true,
		onNeedRefresh() {
			console.log("📦 New version available! Cleaning old caches...");
			caches.keys().then((names) => {
				names.forEach((name) => {
					if (name.includes("precache")) {
						caches.delete(name).catch(() => {});
					}
				});
			});
		},
		onOfflineReady() {
			console.log("✅ App is ready to work offline!");
		},
	});
} else if ("serviceWorker" in navigator && !import.meta.env.PROD) {
	navigator.serviceWorker.getRegistrations().then((registrations) => {
		registrations.forEach((registration) => registration.unregister());
	});
	console.log("🔧 Development mode: Service Workers unregistered");
}

// Listen for updates and clean old caches
if ("serviceWorker" in navigator) {
	navigator.serviceWorker.addEventListener("controllerchange", () => {
		console.log("🎯 Service Worker controller changed - updating to new version!");
		caches.keys().then((names) => {
			names.forEach((name) => {
				if (!name.includes("http-cache") && !name.includes("precache-" + import.meta.env.VITE_APP_VERSION || "")) {
					console.log(`🗑️ Removing old cache: ${name}`);
					caches.delete(name).catch(() => {});
				}
			});
		});
	});

	// Log SW ready status
	navigator.serviceWorker.ready.then(() => {
		console.log("✨ Service Worker ready - auto-updates enabled!");
	});
}

createRoot(document.getElementById("root")!).render(
	<PersistQueryClientProvider
		client={queryClient}
		persistOptions={{ persister: queryPersister, maxAge: queryPersistMaxAge }}
		onSuccess={() => {
			queryClient.resumePausedMutations().catch(() => undefined);
		}}
	>
		<App />
	</PersistQueryClientProvider>
);
