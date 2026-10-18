export type OsPermission = "granted" | "denied" | "default" | "unsupported";

export type OsNotification = {
	title: string;
	subtitle?: string;
	body: string;
	channel: string;
	thread?: string;
	rkey?: string;
	avatar?: string;
	authorDid: string;
};

export type OsActivation = {
	channel: string;
	thread?: string;
	rkey?: string;
};

export type OsNotifierKind = "web" | "native" | "plugin" | "none";

export type OsNotifier = {
	kind: OsNotifierKind;
	permission: () => Promise<OsPermission>;
	requestPermission: () => Promise<OsPermission>;
	show: (notification: OsNotification) => Promise<void>;
	dismiss: (target: string) => Promise<void>;
	clearAll: () => Promise<void>;
	onActivation: (handler: (activation: OsActivation) => void) => () => void;
};

export const targetOf = (notification: {
	channel: string;
	thread?: string;
}): string => notification.thread ?? notification.channel;

export const joinedBody = (notification: OsNotification): string =>
	notification.subtitle
		? `${notification.subtitle}\n${notification.body}`
		: notification.body;
