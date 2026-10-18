const COMBINING_MARKS = /[̀-ͯ]/g;

const EXTENDED_LETTERS: Record<string, string> = {
	ø: "o",
	Ø: "o",
	ł: "l",
	Ł: "l",
	đ: "d",
	Đ: "d",
	ð: "d",
	Ð: "d",
	þ: "th",
	Þ: "th",
	ß: "ss",
	ẞ: "ss",
	æ: "ae",
	Æ: "ae",
	œ: "oe",
	Œ: "oe",
	ı: "i",
	İ: "i",
	ħ: "h",
	Ħ: "h",
	ŧ: "t",
	Ŧ: "t",
	ŋ: "n",
	Ŋ: "n",
};

const EXTENDED_PATTERN = new RegExp(
	`[${Object.keys(EXTENDED_LETTERS).join("")}]`,
	"g",
);

const CACHE_LIMIT = 4096;

const cache = new Map<string, string>();

export const foldText = (value: string): string => {
	const hit = cache.get(value);
	if (hit !== undefined) return hit;

	const folded = value
		.normalize("NFD")
		.replace(COMBINING_MARKS, "")
		.replace(EXTENDED_PATTERN, (char) => EXTENDED_LETTERS[char])
		.toLowerCase();

	if (cache.size >= CACHE_LIMIT) cache.clear();
	cache.set(value, folded);

	return folded;
};
