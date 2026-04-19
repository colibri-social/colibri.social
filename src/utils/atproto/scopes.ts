export const scopes = [
	"atproto",
	"blob:*/*",
	"rpc:app.bsky.actor.getProfile?aud=*",
	"repo:social.colibri.actor.data?action=create&action=update&action=delete",
	"repo:social.colibri.community?action=create&action=update&action=delete",
	"repo:social.colibri.category?action=create&action=update&action=delete",
	"repo:social.colibri.channel?action=create&action=update&action=delete",
	"repo:social.colibri.message?action=create&action=update&action=delete",
	"repo:social.colibri.membership?action=create&action=delete",
	"repo:social.colibri.approval?action=create&action=delete",
	"repo:social.colibri.reaction?action=create&action=delete",
];
