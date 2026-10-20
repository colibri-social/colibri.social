const ascii = (bytes: Uint8Array, start: number, length: number) =>
	String.fromCharCode(...bytes.subarray(start, start + length));

const readUint32 = (bytes: Uint8Array, offset: number) =>
	((bytes[offset] << 24) |
		(bytes[offset + 1] << 16) |
		(bytes[offset + 2] << 8) |
		bytes[offset + 3]) >>>
	0;

const pngIsAnimated = (bytes: Uint8Array) => {
	let offset = 8;
	while (offset + 8 <= bytes.length) {
		const length = readUint32(bytes, offset);
		const type = ascii(bytes, offset + 4, 4);
		if (type === "acTL") return true;
		if (type === "IDAT" || type === "IEND") return false;
		offset += 12 + length;
	}
	return false;
};

const webpIsAnimated = (bytes: Uint8Array) =>
	ascii(bytes, 12, 4) === "VP8X" && (bytes[20] & 0x02) !== 0;

const skipGifSubBlocks = (bytes: Uint8Array, offset: number) => {
	let cursor = offset;
	while (cursor < bytes.length && bytes[cursor] !== 0) {
		cursor += bytes[cursor] + 1;
	}
	return cursor + 1;
};

const gifIsAnimated = (bytes: Uint8Array) => {
	let offset = 13;
	const flags = bytes[10];
	if (flags & 0x80) offset += 3 * 2 ** ((flags & 0x07) + 1);
	let frames = 0;
	while (offset < bytes.length) {
		const marker = bytes[offset];
		if (marker === 0x3b) break;
		if (marker === 0x21) {
			offset = skipGifSubBlocks(bytes, offset + 2);
			continue;
		}
		if (marker !== 0x2c) break;
		frames += 1;
		if (frames > 1) return true;
		const localFlags = bytes[offset + 9];
		offset += 10;
		if (localFlags & 0x80) offset += 3 * 2 ** ((localFlags & 0x07) + 1);
		offset = skipGifSubBlocks(bytes, offset + 1);
	}
	return false;
};

export const isAnimatedImageData = (bytes: Uint8Array): boolean => {
	if (bytes.length < 16) return false;
	if (ascii(bytes, 1, 3) === "PNG") return pngIsAnimated(bytes);
	if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP")
		return webpIsAnimated(bytes);
	if (ascii(bytes, 0, 3) === "GIF") return gifIsAnimated(bytes);
	return false;
};

const INSTANT_FRAME_MS = 10;
const DEFAULT_FRAME_MS = 100;

const frameMs = (ms: number) =>
	ms <= INSTANT_FRAME_MS ? DEFAULT_FRAME_MS : ms;

const readUint16 = (bytes: Uint8Array, offset: number) =>
	(bytes[offset] << 8) | bytes[offset + 1];

const readLittle24 = (bytes: Uint8Array, offset: number) =>
	bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);

const pngLoopMs = (bytes: Uint8Array) => {
	let offset = 8;
	let total = 0;
	let frames = 0;
	while (offset + 8 <= bytes.length) {
		const length = readUint32(bytes, offset);
		const type = ascii(bytes, offset + 4, 4);
		if (type === "IEND") break;
		if (type === "fcTL" && offset + 32 <= bytes.length) {
			const numerator = readUint16(bytes, offset + 28);
			const denominator = readUint16(bytes, offset + 30) || 100;
			total += frameMs((numerator * 1000) / denominator);
			frames += 1;
		}
		offset += 12 + length;
	}
	return frames > 1 ? total : undefined;
};

const webpLoopMs = (bytes: Uint8Array) => {
	let offset = 12;
	let total = 0;
	let frames = 0;
	while (offset + 8 <= bytes.length) {
		const type = ascii(bytes, offset, 4);
		const size =
			bytes[offset + 4] |
			(bytes[offset + 5] << 8) |
			(bytes[offset + 6] << 16) |
			(bytes[offset + 7] << 24);
		const data = offset + 8;
		if (type === "ANMF" && data + 15 <= bytes.length) {
			total += frameMs(readLittle24(bytes, data + 12));
			frames += 1;
		}
		offset = data + size + (size & 1);
	}
	return frames > 1 ? total : undefined;
};

const gifLoopMs = (bytes: Uint8Array) => {
	let offset = 13;
	const flags = bytes[10];
	if (flags & 0x80) offset += 3 * 2 ** ((flags & 0x07) + 1);
	let total = 0;
	let frames = 0;
	let delay = 0;
	while (offset < bytes.length) {
		const marker = bytes[offset];
		if (marker === 0x3b) break;
		if (marker === 0x21) {
			if (bytes[offset + 1] === 0xf9)
				delay = (bytes[offset + 4] | (bytes[offset + 5] << 8)) * 10;
			offset = skipGifSubBlocks(bytes, offset + 2);
			continue;
		}
		if (marker !== 0x2c) break;
		total += frameMs(delay);
		frames += 1;
		delay = 0;
		const localFlags = bytes[offset + 9];
		offset += 10;
		if (localFlags & 0x80) offset += 3 * 2 ** ((localFlags & 0x07) + 1);
		offset = skipGifSubBlocks(bytes, offset + 1);
	}
	return frames > 1 ? total : undefined;
};

export const animationLoopMs = (bytes: Uint8Array): number | undefined => {
	if (bytes.length < 16) return undefined;
	if (ascii(bytes, 1, 3) === "PNG") return pngLoopMs(bytes);
	if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP")
		return webpLoopMs(bytes);
	if (ascii(bytes, 0, 3) === "GIF") return gifLoopMs(bytes);
	return undefined;
};

type Inspection = { animated: boolean; loopMs?: number };

const inspected = new Map<string, Promise<Inspection | undefined>>();

const inspect = (src: string): Promise<Inspection | undefined> => {
	const existing = inspected.get(src);
	if (existing) return existing;
	const pending = fetch(src)
		.then((response) =>
			response.ok ? response.arrayBuffer() : Promise.reject(response.status),
		)
		.then((buffer) => {
			const bytes = new Uint8Array(buffer);
			return {
				animated: isAnimatedImageData(bytes),
				loopMs: animationLoopMs(bytes),
			};
		})
		.catch(() => undefined);
	inspected.set(src, pending);
	return pending;
};

export const sniffAnimation = (src: string): Promise<boolean | undefined> =>
	inspect(src).then((result) => result?.animated);

export const sniffLoopDuration = (src: string): Promise<number | undefined> =>
	inspect(src).then((result) => result?.loopMs);

export const freshAnimationUrl = (src: string): Promise<string | undefined> =>
	fetch(src)
		.then((response) =>
			response.ok ? response.blob() : Promise.reject(response.status),
		)
		.then((blob) => URL.createObjectURL(blob))
		.catch(() => undefined);
