import { createRoot } from "react-dom/client";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import { queryClient, queryPersister, queryPersistMaxAge } from "./lib/queryClient";
import "./index.css";

const isElectron = !!(window as any).electronApp?.isDesktop;

if (import.meta.env.PROD && !isElectron) {
	registerSW({ immediate: true });
} else if ("serviceWorker" in navigator) {
	navigator.serviceWorker.getRegistrations().then((registrations) => {
		registrations.forEach((registration) => registration.unregister());
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
