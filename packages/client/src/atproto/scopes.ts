// We bundle the granular permissions into published permission-set
// lexicons (social.colibri.permission*) and reference each with a single
// `include:` scope. See https://atproto.com/specs/permission#permission-sets
export const buildScopes = (appViewDid: string) => [
	"atproto",
	"blob:*/*",
	"rpc:app.bsky.actor.getProfile?aud=*",
	`include:social.colibri.permissionAccount?aud=${appViewDid}#colibri_appview`,
	`include:social.colibri.permissionCommunity?aud=${appViewDid}#colibri_appview`,
	`include:social.colibri.permissionMessaging?aud=${appViewDid}#colibri_appview`,
	`include:social.colibri.permissionNotification?aud=${appViewDid}#colibri_appview`,
	`include:social.colibri.permissionPush?aud=${appViewDid}#colibri_notif`,
];

export const scopes = buildScopes("did:web:api.colibri.social");
