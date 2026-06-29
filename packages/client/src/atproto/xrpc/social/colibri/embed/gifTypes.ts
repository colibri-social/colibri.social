/**
 * Shared types for the GIF-picker endpoints. These mirror the normalized shape
 * the AppView returns from the Klipy proxy (`social.colibri.embed.*Gifs` /
 * `gifCategories`) — the client never sees Klipy's nested wire format.
 */

/** A single GIF, flattened by the AppView from Klipy's media tree. */
export type GifItem = {
	id: string;
	/** Direct, full-size animated media URL (hotlinked in messages). */
	mediaUrl: string;
	/** Lightweight thumbnail URL for the picker grid. */
	previewUrl: string;
	width?: number;
	height?: number;
};

/** One page of GIF results plus the cursor for "load more". */
export type GifPage = {
	items: Array<GifItem>;
	page: number;
	hasNext: boolean;
};

/** A browsable category for the picker's Categories tab. */
export type GifCategory = {
	/** Display label. */
	name: string;
	/** Search term to run when tapped (may differ from the label). */
	query?: string;
	previewUrl?: string;
};
