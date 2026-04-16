import { createRoot } from "react-dom/client";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import { queryClient, queryPersister, queryPersistMaxAge } from "./lib/queryClient";
import "./index.css";

registerSW({ immediate: true });

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
