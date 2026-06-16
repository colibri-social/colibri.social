/** A platform-agnostic notification to display to the user. */
export type NotificationPayload = {
	title: string;
	body: string;
	/** Collapses notifications that share a tag into one (web/SW + Tauri). */
	tag?: string;
	/** Absolute or root-relative icon URL. Falls back to the app icon. */
	icon?: string;
	/** Routing hints used when the notification is clicked. */
	data?: {
		channelUri?: string;
		messageUri?: string;
	};
};

export type NotificationPermission = "granted" | "denied" | "default";

/**
 * A concrete notification implementation for a single runtime (web, Tauri, …).
 * `notify()` in `index.ts` selects one of these at runtime.
 */
export type NotificationBackend = {
	readonly name: "web" | "tauri" | "noop";
	/** Whether this backend can show notifications in the current environment. */
	isSupported(): boolean;
	getPermission(): Promise<NotificationPermission>;
	/** Must be called from a user gesture on the web. */
	requestPermission(): Promise<NotificationPermission>;
	show(payload: NotificationPayload): Promise<void>;
};
