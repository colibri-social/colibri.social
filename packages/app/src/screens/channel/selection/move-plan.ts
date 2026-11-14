import { MAX_MOVE_SUBJECTS } from "../../../data/source";

type OverrideScope = {
	permissionOverrides?: readonly {
		role?: string;
		member?: string;
		allow?: readonly string[];
		deny?: readonly string[];
	}[];
};

export type Audience = {
	private?: boolean;
	viewers?: readonly string[];
};

export type AudienceChange = {
	changed: boolean;
	toPrivate: boolean;
};

export const viewAudience = (
	channel: (OverrideScope & { private?: boolean }) | undefined,
	category: OverrideScope | undefined,
): Audience => {
	const rules = [channel, category].flatMap((scope, level) =>
		(scope?.permissionOverrides ?? []).flatMap((override) => {
			const state = override.deny?.includes("channel.view")
				? "deny"
				: override.allow?.includes("channel.view")
					? "allow"
					: undefined;
			if (!state) return [];

			const target = override.role
				? `role:${override.role}`
				: `member:${override.member}`;

			return [`${level}:${target}:${state}`];
		}),
	);

	return { private: !!channel?.private, viewers: rules };
};

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
		!!from.private !== !!to.private || !sameSet(from.viewers, to.viewers),
	toPrivate: !!to.private,
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
