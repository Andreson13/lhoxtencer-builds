/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface Window {
	electronApp?: {
		isDesktop: boolean;
		platform: string;
		versions: {
			electron: string;
			chrome: string;
			node: string;
		};
	};
}
