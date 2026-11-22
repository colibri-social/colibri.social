declare module "upng-js" {
	export type ApngFrame = {
		rect: { x: number; y: number; width: number; height: number };
		delay: number;
		dispose: number;
		blend: number;
	};

	export type DecodedPng = {
		width: number;
		height: number;
		depth: number;
		ctype: number;
		frames: ApngFrame[];
		tabs: Record<string, unknown>;
		data: Uint8Array;
	};

	const UPNG: {
		decode: (buffer: ArrayBuffer) => DecodedPng;
		toRGBA8: (image: DecodedPng) => ArrayBuffer[];
	};

	export default UPNG;
}
