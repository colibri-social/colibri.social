import type { Agent } from "@atproto/api";
import type { InitSentryOptions } from "../sentry";

export const EMBED_THEME_TOKENS = [
	"background",
	"foreground",
	"card",
	"card-foreground",
	"popover",
	"popover-foreground",
	"primary",
	"primary-foreground",
	"primary-hover",
	"secondary",
	"secondary-foreground",
	"muted",
	"muted-foreground",
	"accent",
	"accent-foreground",
	"destructive",
	"border",
	"input",
	"ring",
	"sidebar",
	"sidebar-foreground",
	"sidebar-primary",
	"sidebar-primary-foreground",
	"sidebar-accent",
	"sidebar-accent-foreground",
	"sidebar-border",
	"sidebar-ring",
	"radius",
	"radius-sm",
	"radius-md",
	"radius-lg",
	"radius-xl",
	"radius-2xl",
	"radius-3xl",
	"radius-4xl",
	"font-sans",
] as const;

export type EmbedThemeToken = (typeof EMBED_THEME_TOKENS)[number];

export type EmbedThemeTokens = Record<EmbedThemeToken, string>;

export type EmbedColorScheme = "dark" | "light";

export type ColibriEmbedConfig = {
	agent: Agent;
	community: string;
	channel?: string;
	appViewUrl?: string;
	noiseAssetBase?: string;
	scope?: string;
	colorScheme?: EmbedColorScheme;
	theme?: Partial<EmbedThemeTokens>;
	brand?: string;
	onEvent?: (event: EmbedEvent) => void;
	storagePrefix?: string;
	sentry?: false | InitSentryOptions;
};

export type EmbedMembershipState = "member" | "applied" | "none";

export type EmbedRealtimeEventType =
	| "ack"
	| "community_event"
	| "member_event"
	| "application_event"
	| "category_event"
	| "channel_event"
	| "role_event"
	| "message_event"
	| "reaction_event"
	| "user_event"
	| "typing_event"
	| "voice_presence_event"
	| "voice_state_event"
	| "notification_event"
	| "seen_event"
	| "mute_event"
	| "community_creation_progress";

export type EmbedRealtimeEvent = {
	type: EmbedRealtimeEventType;
	data?: unknown;
};

export type EmbedEventBody =
	| {
			kind: "record.created" | "record.updated" | "record.deleted";
			repo: string;
			collection: string;
			rkey: string;
			uri: string;
	  }
	| { kind: "blob.uploaded"; mimeType: string; size: number }
	| {
			kind: "appview.call";
			lxm: string;
			method: string;
			status: number;
			durationMs: number;
			queued: boolean;
	  }
	| { kind: "realtime"; event: EmbedRealtimeEvent }
	| { kind: "navigation"; community: string; channel?: string }
	| { kind: "membership.changed"; state: EmbedMembershipState }
	| { kind: "scopes.missing"; missing: Array<string> }
	| { kind: "auth.expired" }
	| { kind: "error"; code: string };

export type EmbedEvent = { version: 1 } & EmbedEventBody;

export type EmbedEventListener = (event: EmbedEvent) => void;

export type EmbedEmitter = {
	emit: (body: EmbedEventBody) => void;
	on: (listener: EmbedEventListener) => () => void;
};

export type EmbedHandle = {
	unmount: () => void;
	navigate: (target: { channel: string }) => void;
	setTheme: (theme: Partial<EmbedThemeTokens>) => void;
	on: (listener: EmbedEventListener) => () => void;
};
