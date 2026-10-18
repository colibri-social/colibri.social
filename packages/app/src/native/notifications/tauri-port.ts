export type TauriPort = {
	invoke: <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
	listen: <T>(
		event: string,
		handler: (event: { payload: T }) => void,
	) => Promise<() => void>;
};

export const tauriPort = (): TauriPort => ({
	invoke: async (command, args) => {
		const { invoke } = await import("@tauri-apps/api/core");
		return invoke(command, args);
	},
	listen: async (event, handler) => {
		const { listen } = await import("@tauri-apps/api/event");
		return listen(event, handler);
	},
});
