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

const sniffed = new Map<string, Promise<boolean | undefined>>();

export const sniffAnimation = (src: string): Promise<boolean | undefined> => {
	const existing = sniffed.get(src);
	if (existing) return existing;
	const pending = fetch(src)
		.then((response) =>
			response.ok ? response.arrayBuffer() : Promise.reject(response.status),
		)
		.then((buffer) => isAnimatedImageData(new Uint8Array(buffer)))
		.catch(() => undefined);
	sniffed.set(src, pending);
	return pending;
};
