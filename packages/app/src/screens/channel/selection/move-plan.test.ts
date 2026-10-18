import { describe, expect, it } from "vitest";
import {
	audienceChange,
	describeMoveBlock,
	moveBlock,
	movedToast,
	sharedOrigin,
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
		expect(audienceChange({}, {}).changed).toBe(false);
		expect(audienceChange({}, { visibleToRoles: ["mods"] })).toEqual({
			changed: true,
			toPrivate: true,
		});
		expect(
			audienceChange(
				{ visibleToRoles: ["mods", "owner"] },
				{ visibleToRoles: ["owner", "mods"] },
			).changed,
		).toBe(false);
		expect(audienceChange({ visibleToRoles: ["mods"] }, {}).toPrivate).toBe(
			false,
		);
	});

	it("words the toast by count", () => {
		expect(movedToast(1)).toBe("Message moved");
		expect(movedToast(3)).toBe("3 messages moved");
	});
});
