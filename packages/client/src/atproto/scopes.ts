// We bundle the granular permissions into published permission-set
// lexicons (social.colibri.permission*) and reference each with a single
// `include:` scope. See https://atproto.com/specs/permission#permission-sets
export const buildScopes = (appViewDid: string) => [
	"atproto",
	"blob:*/*",
	"rpc:app.bsky.actor.getProfile?aud=*",
	"rpc:com.atproto.identity.resolveDid?aud=*",
	"rpc:social.colibri.voice.signal?aud=*",
	"rpc:social.colibri.voice.moderate?aud=*",
	`include:social.colibri.permissionAccount?aud=${appViewDid}#colibri_appview`,
	`include:social.colibri.permissionCommunity?aud=${appViewDid}#colibri_appview`,
	`include:social.colibri.permissionMessaging?aud=${appViewDid}#colibri_appview`,
	`include:social.colibri.permissionNotification?aud=${appViewDid}#colibri_appview`,
	`include:social.colibri.permissionPush?aud=${appViewDid}#colibri_notif`,
];

export const scopes = buildScopes("did:web:api.colibri.social");

export const PERMISSION_SET_LABELS: Record<string, string> = {
	"social.colibri.permissionAccount": "Account & profile",
	"social.colibri.permissionCommunity": "Communities & channels",
	"social.colibri.permissionMessaging": "Messages & membership",
	"social.colibri.permissionNotification": "Notifications",
	"social.colibri.permissionPush": "Push notifications",
	"social.colibri.voice.signal": "Voice channels",
	"social.colibri.voice.moderate": "Voice channels",
};

const PERMISSION_SET_MARKERS: Record<string, string> = {
	"social.colibri.permissionAccount": "social.colibri.actor.getData",
	"social.colibri.permissionCommunity": "social.colibri.community.getData",
	"social.colibri.permissionMessaging": "social.colibri.membership",
	"social.colibri.permissionNotification":
		"social.colibri.notification.listNotifications",
	"social.colibri.permissionPush": "social.colibri.notification.registerPush",
};

const STANDALONE_SCOPE_MARKERS: Record<string, string> = {
	"social.colibri.voice.signal": "social.colibri.voice.signal?aud=*",
	"social.colibri.voice.moderate": "social.colibri.voice.moderate?aud=*",
};

export const scopeSetLabel = (nsid: string): string =>
	PERMISSION_SET_LABELS[nsid] ?? "Core access";

export const getMissingScopeSets = (
	grantedScope: string | undefined,
): string[] => {
	if (!grantedScope) return [];
	return Object.entries({
		...PERMISSION_SET_MARKERS,
		...STANDALONE_SCOPE_MARKERS,
	})
		.filter(([, marker]) => !grantedScope.includes(marker))
		.map(([nsid]) => nsid);
};
