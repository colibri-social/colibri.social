export const namespace = (appViewDid: string, did: string): string =>
	`${appViewDid}:${did}`;

export const communityKey = (ns: string, uri: string): string => `${ns}:${uri}`;

export const messagesKey = (ns: string, channelUri: string): string =>
	`${ns}:${channelUri}`;

export const bskyPostKey = (atUri: string): string => `post:${atUri}`;

export const bskyHandleKey = (handle: string): string => `handle:${handle}`;

export const bskyMuVerificationKey = (did: string): string =>
	`muVerification:${did}`;

export const BSKY_MU_TRUSTED_LIST_KEY = "muTrustedList";

export const labelerLabelsKey = (did: string): string => `labels:${did}`;

export const labelerBadgeDefinitionsKey = (did: string): string =>
	`badgeDefinitions:${did}`;

export const externalAccountLinkKey = (
	labelerDid: string,
	subject: string,
): string => `externalLink:${labelerDid}:${subject}`;
