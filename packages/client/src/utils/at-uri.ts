import { buildSpacePath } from "../atproto/colibri-channel-url";
import { COLLECTIONS } from "../atproto/lexicons";

/**
 * Resolves a record reference that may be either a full AT URI or a bare
 * record key into a full AT URI within the given repo and collection.
 */
export const toRecordUri = (
	did: string,
	collection: string,
	rkeyOrUri: string,
): string =>
	rkeyOrUri.startsWith("at://")
		? rkeyOrUri
		: `at://${did}/${collection}/${rkeyOrUri}`;

export const channelIdentity = (
	channelUri: string,
): { communityDid: string; rkey: string } => {
	const segments = channelUri.replace("at://", "").split("/");
	return { communityDid: segments[0], rkey: segments[segments.length - 1] };
};

export const messageIdentity = (
	messageUri: string,
): { did: string; rkey: string } | undefined => {
	const segments = messageUri.replace("at://", "").split("/");
	if (segments.length < 3) return undefined;

	const [did, collection, rkey] = segments.slice(-3);
	if (collection !== COLLECTIONS.message) return undefined;
	if (!did.startsWith("did:") || !rkey) return undefined;

	return { did, rkey };
};

export type AtURIDescription = {
	spaceAuthority?: string;
	spaceType?: string;
	spaceKey?: string;
	did?: string;
	collection?: string;
	identifier?: string;
};

export const describeAtURI = (uri: string): AtURIDescription => {
	if (!uri.startsWith("at://"))
		return uri.startsWith("did:") ? { did: uri } : { identifier: uri };

	const [authority, ...rest] = uri.slice("at://".length).split("/");

	if (rest[0] !== "space")
		return {
			did: authority || undefined,
			collection: rest[0] || undefined,
			identifier: rest[1] || undefined,
		};

	const [, spaceType, spaceKey, repo, collection, rkey] = rest;

	return {
		spaceAuthority: authority || undefined,
		spaceType: spaceType || undefined,
		spaceKey: spaceKey || undefined,
		did: repo || undefined,
		collection: collection || undefined,
		identifier: rkey || undefined,
	};
};

export const channelPath = (channelUri: string): string =>
	buildSpacePath(channelUri) ??
	`/app/c/${channelIdentity(channelUri).communityDid}`;

export class AtURI {
	public uri: string;
	public did: string;
	public collection: string;
	public identifier: string;

	constructor(uri: string) {
		this.uri = uri;

		const { did, collection, identifier } = AtURI.parseAtURI(uri);

		this.did = did;
		this.collection = collection;
		this.identifier = identifier;
	}

	/**
	 * Parses an AT URI into it's did, collection and identifier
	 * @param uri The URI to parse
	 * @returns An object containing the DID, collection and identifier
	 */
	public static parseAtURI = (uri: string) => {
		const parts = uri.split("/");

		return {
			did: parts[2],
			collection: parts[3],
			identifier: parts[4],
		};
	};
}
