import type { VoiceVideoSource } from "./types";

export type TileView = {
	height: number;
	visible: boolean;
};

export type LayerContext = {
	source: VoiceVideoSource;
	spatialLayers: number;
	documentHidden: boolean;
	pixelRatio: number;
};

export type ConsumerPreference = {
	spatialLayer: number;
	temporalLayer?: number;
	paused: boolean;
};

export const PREFERENCE_DEBOUNCE_MS = 300;

const THUMBNAIL_HEIGHT = 160;

const THUMBNAIL_TEMPORAL_LAYER = 1;

const TOP_LAYER_HEIGHT: Record<VoiceVideoSource, number> = {
	cam: 720,
	screen: 1080,
};

const UPSCALE_TOLERANCE: Record<VoiceVideoSource, number> = {
	cam: 1.25,
	screen: 1,
};

const DEFAULT_SPATIAL_LAYERS: Record<VoiceVideoSource, number> = {
	cam: 3,
	screen: 2,
};

export const tileKeyFor = (owner: {
	did: string;
	source: VoiceVideoSource;
}): string => {
	return `${owner.source === "screen" ? "s" : "p"}:${owner.did}`;
};

export const spatialLayersOf = (
	scalabilityMode: string | undefined,
	source: VoiceVideoSource,
): number => {
	const match = scalabilityMode?.match(/^[LS](\d+)T\d+/);
	const layers = match ? Number(match[1]) : Number.NaN;

	return Number.isInteger(layers) && layers > 0
		? layers
		: DEFAULT_SPATIAL_LAYERS[source];
};

export const layerHeight = (
	layer: number,
	spatialLayers: number,
	source: VoiceVideoSource,
): number => {
	return TOP_LAYER_HEIGHT[source] / 2 ** (spatialLayers - 1 - layer);
};

export const preferredLayers = (
	view: TileView,
	context: LayerContext,
): ConsumerPreference => {
	const top = Math.max(0, context.spatialLayers - 1);

	if (!view.visible || context.documentHidden || view.height <= 0) {
		return { spatialLayer: 0, paused: true };
	}

	const pixels = view.height * Math.max(1, context.pixelRatio);
	const tolerance = UPSCALE_TOLERANCE[context.source];
	let spatialLayer = top;

	for (let layer = 0; layer < top; layer += 1) {
		const height = layerHeight(layer, context.spatialLayers, context.source);

		if (height * tolerance >= pixels) {
			spatialLayer = layer;
			break;
		}
	}

	return view.height <= THUMBNAIL_HEIGHT
		? {
				spatialLayer,
				temporalLayer: THUMBNAIL_TEMPORAL_LAYER,
				paused: false,
			}
		: { spatialLayer, paused: false };
};

export const samePreference = (
	left: ConsumerPreference | undefined,
	right: ConsumerPreference,
): boolean => {
	return (
		!!left &&
		left.paused === right.paused &&
		left.spatialLayer === right.spatialLayer &&
		left.temporalLayer === right.temporalLayer
	);
};
