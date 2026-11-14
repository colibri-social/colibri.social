import { describe, expect, it } from "vitest";
import {
	audienceChange,
	describeMoveBlock,
	moveBlock,
	movedToast,
	sharedOrigin,
	viewAudience,
} from "./move-plan";

describe("move plan", () => {
	it("blocks empty, oversized and unpermitted selections", () => {
		expect(moveBlock(0, true)).toBe("nothing-selected");
		expect(moveBlock(51, true)).toBe("too-many");
		expect(moveBlock(3, false)).toBe("not-permitted");
		expect(moveBlock(3, true)).toBeUndefined();
		expect(describeMoveBlock("too-many")).toContain("50");
	});

	it("finds the place moved messages came from", () => {
		expect(sharedOrigin(["general", "general"], "thread")).toBe("general");
		expect(sharedOrigin(["general", "design"], "thread")).toBeUndefined();
		expect(sharedOrigin(["thread"], "thread")).toBeUndefined();
		expect(sharedOrigin([], "thread")).toBeUndefined();
	});

	it("notices when the audience changes", () => {
		const open = viewAudience({}, undefined);
		const staff = viewAudience(
			{
				private: true,
				permissionOverrides: [
					{ role: "members", allow: [], deny: ["channel.view"] },
					{ role: "mods", allow: ["channel.view"], deny: [] },
				],
			},
			undefined,
		);

		expect(audienceChange(open, viewAudience({}, undefined)).changed).toBe(
			false,
		);
		expect(audienceChange(open, staff)).toEqual({
			changed: true,
			toPrivate: true,
		});
		expect(
			audienceChange(
				staff,
				viewAudience(
					{
						private: true,
						permissionOverrides: [
							{ role: "mods", allow: ["channel.view", "message.send"] },
							{ role: "members", deny: ["channel.view"] },
						],
					},
					undefined,
				),
			).changed,
		).toBe(false);
		expect(audienceChange(staff, open).toPrivate).toBe(false);
	});

	it("words the toast by count", () => {
		expect(movedToast(1)).toBe("Message moved");
		expect(movedToast(3)).toBe("3 messages moved");
	});
});
