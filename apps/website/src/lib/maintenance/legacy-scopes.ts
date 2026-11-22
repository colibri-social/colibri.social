export const buildLegacyScopes = (appViewDid: string) => {
	return [
		"atproto",
		"blob:*/*",
		"rpc:app.bsky.actor.getProfile?aud=*",
		"rpc:com.atproto.identity.resolveDid?aud=*",
		"rpc:social.colibri.voice.signal?aud=*",
		"rpc:social.colibri.voice.moderate?aud=*",
		"rpc:social.colibri.labeler.linkExternalAccount?aud=*",
		"rpc:social.colibri.labeler.unlinkExternalAccount?aud=*",
		`include:social.colibri.permissionAccount?aud=${appViewDid}#colibri_appview`,
		`include:social.colibri.permissionCommunity?aud=${appViewDid}#colibri_appview`,
		`include:social.colibri.permissionMessaging?aud=${appViewDid}#colibri_appview`,
		`include:social.colibri.permissionNotification?aud=${appViewDid}#colibri_appview`,
		`include:social.colibri.permissionPush?aud=${appViewDid}#colibri_notif`,
	];
};

export const legacyScopes = buildLegacyScopes("did:web:api.colibri.social");
