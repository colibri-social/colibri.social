export const getAppViewHost = (protocol: "ws" | "http") =>
	import.meta.env.DEV
		? `${protocol}://127.0.0.1:8000`
		: `${protocol}s://api.colibri.social`;
