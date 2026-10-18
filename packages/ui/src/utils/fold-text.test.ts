import { describe, expect, it } from "vitest";
import { foldText } from "./fold-text";

describe("foldText", () => {
	it("strips accents and lowercases", () => {
		expect(foldText("José")).toBe("jose");
		expect(foldText("Ünïcôdé")).toBe("unicode");
		expect(foldText("Ångström")).toBe("angstrom");
		expect(foldText("Renée")).toBe("renee");
	});

	it("leaves plain ASCII alone apart from case", () => {
		expect(foldText("Jose")).toBe("jose");
		expect(foldText("louis.escher.social")).toBe("louis.escher.social");
	});

	it("matches in both directions", () => {
		expect(foldText("José").startsWith(foldText("Jose"))).toBe(true);
		expect(foldText("Jose").startsWith(foldText("José"))).toBe(true);
	});

	it("folds letters that NFD does not decompose", () => {
		expect(foldText("Jørgen")).toBe("jorgen");
		expect(foldText("Łukasz")).toBe("lukasz");
		expect(foldText("Straße")).toBe("strasse");
		expect(foldText("Đorđe")).toBe("dorde");
		expect(foldText("Æther")).toBe("aether");
		expect(foldText("Þór")).toBe("thor");
	});

	it("folds precomposed and decomposed input identically", () => {
		const precomposed = "Jos\u00e9";
		const decomposed = "Jose\u0301";

		expect(precomposed).not.toBe(decomposed);
		expect(foldText(precomposed)).toBe(foldText(decomposed));
	});

	it("returns an empty string unchanged", () => {
		expect(foldText("")).toBe("");
	});

	it("keeps non-Latin vowel signs intact", () => {
		expect(foldText("हिंदी")).toBe("हिंदी");
		expect(foldText("ไทย")).toBe("ไทย");
		expect(foldText("日本語")).toBe("日本語");
	});

	it("returns the same result when served from cache", () => {
		expect(foldText("Zoë")).toBe("zoe");
		expect(foldText("Zoë")).toBe("zoe");
	});
});
