import { GIFEncoder } from "gifenc";

export const STRIP_PART_SIZE = 32;
export const STRIP_PARTS = 3;
export const STRIP_FRAME_DELAYS = [60, 120, 60, 120, 60, 120, 60, 120];

const STRIP_PALETTE = [
	[0, 0, 0],
	[255, 140, 0],
	[40, 120, 255],
];
const DOT_RADIUS = 7;

const stripPixel = (globalX: number, y: number, frame: number) => {
	const travel = STRIP_PART_SIZE * STRIP_PARTS;
	const centerX = ((frame + 0.5) / STRIP_FRAME_DELAYS.length) * travel;
	const centerY = STRIP_PART_SIZE / 2;
	const distance = Math.hypot(globalX - centerX, y - centerY);

	if (distance > DOT_RADIUS) return 0;

	return distance > DOT_RADIUS - 2 ? 2 : 1;
};

export const stripPartGif = (part: number) => {
	const encoder = GIFEncoder();

	STRIP_FRAME_DELAYS.forEach((delay, frame) => {
		const index = new Uint8Array(STRIP_PART_SIZE * STRIP_PART_SIZE);

		for (let y = 0; y < STRIP_PART_SIZE; y++) {
			for (let x = 0; x < STRIP_PART_SIZE; x++) {
				index[y * STRIP_PART_SIZE + x] = stripPixel(
					part * STRIP_PART_SIZE + x,
					y,
					frame,
				);
			}
		}

		encoder.writeFrame(index, STRIP_PART_SIZE, STRIP_PART_SIZE, {
			palette: STRIP_PALETTE,
			delay,
			transparent: true,
			transparentIndex: 0,
		});
	});
	encoder.finish();

	return encoder.bytes();
};

export const gifDataUrl = (bytes: Uint8Array) => {
	let binary = "";

	for (const byte of bytes) binary += String.fromCharCode(byte);

	return `data:image/gif;base64,${btoa(binary)}`;
};
