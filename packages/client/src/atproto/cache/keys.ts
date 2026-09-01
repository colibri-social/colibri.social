export const namespace = (appViewDid: string, did: string): string =>
	`${appViewDid}:${did}`;

export const communityKey = (ns: string, communityDid: string): string =>
	`${ns}:${communityDid}`;

export const threadsKey = (ns: string, communityDid: string): string =>
	`${ns}:${communityDid}`;

export const messagesKey = (ns: string, channelSpace: string): string =>
	`${ns}:${channelSpace}`;

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
