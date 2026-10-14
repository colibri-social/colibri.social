import { MAX_MOVE_SUBJECTS } from "../../../data/source";

export type Audience = {
	visibleToRoles?: readonly string[];
	visibleToMembers?: readonly string[];
};

export type AudienceChange = {
	changed: boolean;
	toPrivate: boolean;
};

const isPrivate = (audience: Audience) =>
	(audience.visibleToRoles?.length ?? 0) > 0 ||
	(audience.visibleToMembers?.length ?? 0) > 0;

const sameSet = (
	a: readonly string[] | undefined,
	b: readonly string[] | undefined,
) => {
	const left = new Set(a ?? []);
	const right = new Set(b ?? []);
	if (left.size !== right.size) return false;
	for (const entry of left) if (!right.has(entry)) return false;
	return true;
};

export const audienceChange = (
	from: Audience,
	to: Audience,
): AudienceChange => ({
	changed:
		isPrivate(from) !== isPrivate(to) ||
		!sameSet(from.visibleToRoles, to.visibleToRoles) ||
		!sameSet(from.visibleToMembers, to.visibleToMembers),
	toPrivate: isPrivate(to),
});

export type MoveBlock = "nothing-selected" | "too-many" | "not-permitted";

export const moveBlock = (
	count: number,
	canMove: boolean,
): MoveBlock | undefined => {
	if (!canMove) return "not-permitted";
	if (count === 0) return "nothing-selected";
	if (count > MAX_MOVE_SUBJECTS) return "too-many";
	return undefined;
};

export const describeMoveBlock = (block: MoveBlock) => {
	switch (block) {
		case "nothing-selected":
			return "Select some messages first.";
		case "too-many":
			return `You can move up to ${MAX_MOVE_SUBJECTS} messages at once.`;
		default:
			return "You're not allowed to move messages.";
	}
};

export const sharedOrigin = (
	channels: readonly string[],
	here: string,
): string | undefined => {
	const first = channels[0];
	if (!first || first === here) return undefined;
	return channels.every((channel) => channel === first) ? first : undefined;
};

export const movedToast = (count: number) =>
	count === 1 ? "Message moved" : `${count} messages moved`;
