export const EMOJI_NAME_MIN = 2;
export const EMOJI_NAME_MAX = 32;
export const EMOJI_PACK_NAME_MAX = 64;

const EMOJI_NAME_PATTERN = /^[a-z0-9_]+$/;

export const normalizeEmojiName = (value: string) =>
	value
		.trim()
		.toLowerCase()
		.replace(/^:+|:+$/g, "")
		.replace(/[\s-]+/g, "_");

export const emojiNameFromFile = (fileName: string) => {
	const base = normalizeEmojiName(fileName.replace(/\.[^.]+$/, "")).replace(
		/[^a-z0-9_]/g,
		"",
	);
	const trimmed = base.slice(0, EMOJI_NAME_MAX);
	return trimmed.length >= EMOJI_NAME_MIN ? trimmed : "emoji";
};

export const uniqueEmojiName = (name: string, taken: ReadonlySet<string>) => {
	if (!taken.has(name)) return name;
	for (let index = 2; ; index++) {
		const suffix = `_${index}`;
		const candidate = `${name.slice(0, EMOJI_NAME_MAX - suffix.length)}${suffix}`;
		if (!taken.has(candidate)) return candidate;
	}
};

export const emojiNameError = (
	value: string,
	taken: ReadonlySet<string> = new Set(),
): string | undefined => {
	const name = normalizeEmojiName(value);
	if (name.length < EMOJI_NAME_MIN)
		return `Use at least ${EMOJI_NAME_MIN} characters.`;
	if (name.length > EMOJI_NAME_MAX)
		return `Use at most ${EMOJI_NAME_MAX} characters.`;
	if (!EMOJI_NAME_PATTERN.test(name))
		return "Use only letters, numbers and underscores.";
	if (taken.has(name)) return `:${name}: is already taken.`;
	return undefined;
};
