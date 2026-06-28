// We bundle the granular permissions into published permission-set
// lexicons (social.colibri.permission.*) and reference each with a single
// `include:` scope. See https://atproto.com/specs/permission#permission-sets
export const scopes = [
	"atproto",
	"blob:*/*",
	"rpc:app.bsky.actor.getProfile?aud=*",
	"include:social.colibri.permission.account?aud=did:web:api.colibri.social#colibri_appview",
	"include:social.colibri.permission.community?aud=did:web:api.colibri.social#colibri_appview",
	"include:social.colibri.permission.messaging?aud=did:web:api.colibri.social#colibri_appview",
	"include:social.colibri.permission.notification?aud=did:web:api.colibri.social#colibri_notif",
];
