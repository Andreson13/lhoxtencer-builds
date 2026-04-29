import { createRoot } from "react-dom/client";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import { queryClient, queryPersister, queryPersistMaxAge } from "./lib/queryClient";
import "./index.css";

const isElectron = !!(window as any).electronApp?.isDesktop;

if (import.meta.env.PROD && !isElectron) {
	registerSW({
		immediate: true,
		onNeedRefresh() {
			console.log("SW: New version available, cleaning old caches");
			caches.keys().then((names) => {
				names.forEach((name) => {
					if (name.includes("precache")) {
						caches.delete(name).catch(() => {});
					}
				});
			});
		},
	});
} else if ("serviceWorker" in navigator) {
	navigator.serviceWorker.getRegistrations().then((registrations) => {
		registrations.forEach((registration) => registration.unregister());
	});
}

// Listen for updates and clean old caches
if ("serviceWorker" in navigator) {
	navigator.serviceWorker.addEventListener("controllerchange", () => {
		console.log("SW: Controller changed, clearing obsolete caches");
		caches.keys().then((names) => {
			names.forEach((name) => {
				if (!name.includes("http-cache") && !name.includes("precache-" + import.meta.env.VITE_APP_VERSION || "")) {
					caches.delete(name).catch(() => {});
				}
			});
		});
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
