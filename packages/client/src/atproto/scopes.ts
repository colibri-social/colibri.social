const PERMISSION_SETS = [
	"social.colibri.beta.permissionAccount",
	"social.colibri.beta.permissionCommunity",
	"social.colibri.beta.permissionMessaging",
	"social.colibri.beta.permissionNotification",
] as const;

const PUSH_PERMISSION_SET = "social.colibri.beta.permissionPush";

export const WILDCARD_RPC = [
	"social.colibri.beta.sync.subscribeEvents",
	"social.colibri.beta.voice.subscribeSignals",
	"social.colibri.beta.voice.moderate",
	"social.colibri.labeler.linkExternalAccount",
	"social.colibri.labeler.unlinkExternalAccount",
] as const;

export const buildScopes = (appViewDid: string) => [
	"atproto",
	"blob:*/*",
	...WILDCARD_RPC.map((lxm) => `rpc:${lxm}?aud=*`),
	...PERMISSION_SETS.map(
		(nsid) => `include:${nsid}?aud=${appViewDid}#colibri_appview`,
	),
	`include:${PUSH_PERMISSION_SET}?aud=${appViewDid}#colibri_notifs`,
];

export const scopes = buildScopes("did:web:spaces-api.colibri.social");

export const PERMISSION_SET_LABELS: Record<string, string> = {
	"social.colibri.beta.permissionAccount": "Account & profile",
	"social.colibri.beta.permissionCommunity": "Communities & channels",
	"social.colibri.beta.permissionMessaging": "Messages & membership",
	"social.colibri.beta.permissionNotification": "Notifications",
	"social.colibri.beta.permissionPush": "Push notifications",
	"social.colibri.beta.sync.subscribeEvents": "Live updates",
	"social.colibri.beta.voice.subscribeSignals": "Voice channels",
	"social.colibri.beta.voice.moderate": "Voice channels",
	"social.colibri.labeler.linkExternalAccount": "Supporter badges",
	"social.colibri.labeler.unlinkExternalAccount": "Supporter badges",
};

const PERMISSION_SET_MARKERS: Record<string, readonly string[]> = {
	"social.colibri.beta.permissionAccount": [
		"include:social.colibri.beta.permissionAccount",
		"social.colibri.beta.actor.deleteAccount",
	],
	"social.colibri.beta.permissionCommunity": [
		"include:social.colibri.beta.permissionCommunity",
		"social.colibri.beta.community.registerCredentials",
	],
	"social.colibri.beta.permissionMessaging": [
		"include:social.colibri.beta.permissionMessaging",
		"social.colibri.beta.channel.listMessages",
	],
	"social.colibri.beta.permissionNotification": [
		"include:social.colibri.beta.permissionNotification",
		"social.colibri.beta.notification.listNotifications",
	],
	"social.colibri.beta.permissionPush": [
		"include:social.colibri.beta.permissionPush",
		"social.colibri.beta.notification.registerPush",
	],
};

const STANDALONE_SCOPE_MARKERS: Record<string, readonly string[]> =
	Object.fromEntries(WILDCARD_RPC.map((lxm) => [lxm, [`${lxm}?aud=*`]]));

export const scopeSetLabel = (nsid: string): string =>
	PERMISSION_SET_LABELS[nsid] ?? "Core access";

const SCOPE_SET_MARKERS: Record<string, readonly string[]> = {
	...PERMISSION_SET_MARKERS,
	...STANDALONE_SCOPE_MARKERS,
};

export const getMissingScopeSets = (
	grantedScope: string | undefined,
): string[] => {
	if (!grantedScope) return [];
	return Object.entries(SCOPE_SET_MARKERS)
		.filter(([, markers]) => !markers.some((m) => grantedScope.includes(m)))
		.map(([nsid]) => nsid);
};

export const getGrantedScopeSets = (
	grantedScope: string | undefined,
): string[] => {
	if (!grantedScope) return [];
	const missing = new Set(getMissingScopeSets(grantedScope));
	return Object.keys(SCOPE_SET_MARKERS).filter((nsid) => !missing.has(nsid));
};
