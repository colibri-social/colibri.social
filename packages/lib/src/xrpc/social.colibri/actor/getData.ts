import type { JsonBlobRef } from "@atproto/lexicon";
import type { OnlineState } from "../../../shared.js";

/**
 * The name plate an actor selected, resolved by the AppView from the
 * `social.colibri.actor.plate` record their profile points at. `picture`
 * resolves against the actor's own DID, like their avatar.
 */
export type ProfilePlate = {
	uri: string;
	name: string;
	color: string;
	picture: JsonBlobRef;
};

/** Colibri-only profile theming, from `social.colibri.actor.profile`. */
export type ProfileTheme = {
	accentColor?: string;
	gradient?: {
		primary?: string;
		secondary?: string;
	};
	bannerColor?: string;
	plate?: ProfilePlate;
};

export type ActorData = {
	did: string;
	handle: string;
	data: {
		displayName: string;
		avatar?: JsonBlobRef;
		banner?: JsonBlobRef;
		description?: string;
		isBot: boolean;
		onlineState: OnlineState;
		/**
		 * Whether the mirrored profile fields are served live from the user's
		 * Bluesky profile. When true, those fields are read-only in Colibri.
		 * Optional so the leaner `Member`/`Applicant` data shapes stay assignable
		 * to `ActorData`; the AppView always populates it on `getData`.
		 */
		syncBluesky?: boolean;
		theme?: ProfileTheme;
		status?: {
			emoji?: string;
			text: string;
		};
		/** Label value of the badge the user chose as primary; absent = automatic. */
		preferredBadge?: string;
	};
};
