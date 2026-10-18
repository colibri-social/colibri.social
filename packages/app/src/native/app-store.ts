const STORE_PLATFORMS = /Mac|iPhone|iPad|iPod|Android/;

export const sellsThroughAppStore = () =>
	typeof window !== "undefined" &&
	"__TAURI_INTERNALS__" in window &&
	STORE_PLATFORMS.test(navigator.userAgent);
