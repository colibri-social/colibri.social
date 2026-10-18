import { describe, expect, it } from "vitest";
import {
	DEFAULT_AVATAR_SET,
	defaultAvatar,
	defaultAvatarFor,
	defaultAvatarSvg,
	defaultAvatarUrl,
} from "./default-avatars";

describe("defaultAvatarFor", () => {
	it("picks the same avatar for the same seed", () => {
		const seed = "did:plc:ewvi7nxzyoun6zhxrhs64oiz";
		expect(defaultAvatarFor(seed)).toBe(defaultAvatarFor(seed));
	});

	it("only picks from the given set", () => {
		const set = ["feather-quill", "feather-fan"] as const;
		for (let index = 0; index < 50; index += 1) {
			expect(set).toContain(defaultAvatarFor(`did:plc:${index}`, set));
		}
	});

	it("falls back to the default set when the set is empty", () => {
		expect(DEFAULT_AVATAR_SET).toContain(defaultAvatarFor("did:plc:empty", []));
	});

	it("spreads seeds across the whole set", () => {
		const picked = new Set<string>();
		for (let index = 0; index < 400; index += 1) {
			picked.add(defaultAvatarFor(`did:plc:user${index}`));
		}
		expect(picked.size).toBe(DEFAULT_AVATAR_SET.length);
	});
});

describe("defaultAvatarSvg", () => {
	for (const id of DEFAULT_AVATAR_SET) {
		it(`draws ${id} flat on a solid background`, () => {
			const svg = defaultAvatarSvg(id);
			expect(svg).not.toMatch(/Gradient|url\(#/);
			expect(svg).toContain(
				`<rect width="1024" height="1024" fill="${defaultAvatar(id).background}"/>`,
			);
		});
	}

	it("is the five feathers, each on its own background", () => {
		expect(DEFAULT_AVATAR_SET).toHaveLength(5);
		for (const id of DEFAULT_AVATAR_SET) expect(id).toMatch(/^feather-/);
		const backgrounds = DEFAULT_AVATAR_SET.map(
			(id) => defaultAvatar(id).background,
		);
		expect(new Set(backgrounds).size).toBe(backgrounds.length);
	});

	it("caches the data url", () => {
		expect(defaultAvatarUrl("feather-fan")).toBe(
			defaultAvatarUrl("feather-fan"),
		);
		expect(defaultAvatarUrl("feather-fan")).toMatch(
			/^data:image\/svg\+xml;charset=utf-8,/,
		);
	});
});
