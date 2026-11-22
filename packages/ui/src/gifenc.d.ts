declare module "gifenc" {
	export type Palette = number[][];

	export type QuantizeFormat = "rgb565" | "rgb444" | "rgba4444";

	export type GifFrameOptions = {
		palette?: Palette;
		delay?: number;
		transparent?: boolean;
		transparentIndex?: number;
		repeat?: number;
		colorDepth?: number;
		dispose?: number;
		first?: boolean;
	};

	export type GifEncoder = {
		writeFrame: (
			index: Uint8Array,
			width: number,
			height: number,
			options?: GifFrameOptions,
		) => void;
		finish: () => void;
		bytes: () => Uint8Array<ArrayBuffer>;
		reset: () => void;
	};

	export function GIFEncoder(options?: {
		initialCapacity?: number;
		auto?: boolean;
	}): GifEncoder;

	export function quantize(
		rgba: Uint8Array | Uint8ClampedArray,
		maxColors: number,
		options?: {
			format?: QuantizeFormat;
			oneBitAlpha?: boolean | number;
			clearAlpha?: boolean;
			clearAlphaColor?: number;
			clearAlphaThreshold?: number;
		},
	): Palette;

	export function applyPalette(
		rgba: Uint8Array | Uint8ClampedArray,
		palette: Palette,
		format?: QuantizeFormat,
	): Uint8Array;
}
