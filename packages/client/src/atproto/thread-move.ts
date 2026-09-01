import type { MessageView } from "./views";

export type MoveSubject = {
	space: string;
	author: string;
	rkey: string;
	uri: string;
};

export type MovePlan =
	| { kind: "rewrite"; source: string; subjects: Array<MoveSubject> }
	| { kind: "moderate"; source: string; subjects: Array<MoveSubject> }
	| { kind: "blocked"; reason: MoveBlockReason };

export type MoveBlockReason =
	| "nothing-selected"
	| "mixed-sources"
	| "legacy-message"
	| "not-permitted";

export const toMoveSubject = (message: MessageView): MoveSubject => ({
	space: message.channel,
	author: message.author.did,
	rkey: message.rkey,
	uri: message.uri,
});

export const planMove = (
	messages: ReadonlyArray<MessageView>,
	options: { actor: string; canModerate: boolean },
): MovePlan => {
	if (messages.length === 0)
		return { kind: "blocked", reason: "nothing-selected" };
	if (messages.some((m) => m.legacy))
		return { kind: "blocked", reason: "legacy-message" };

	const sources = new Set(messages.map((m) => m.channel));
	if (sources.size !== 1) return { kind: "blocked", reason: "mixed-sources" };

	const source = messages[0].channel;
	const ordered = [...messages].sort((a, b) => (a.rkey < b.rkey ? -1 : 1));
	const subjects = ordered.map(toMoveSubject);

	const allOwn = ordered.every((m) => m.author.did === options.actor);
	if (allOwn) return { kind: "rewrite", source, subjects };

	if (!options.canModerate) return { kind: "blocked", reason: "not-permitted" };

	return { kind: "moderate", source, subjects };
};

export const describeMoveBlock = (reason: MoveBlockReason): string => {
	switch (reason) {
		case "nothing-selected":
			return "Select some messages first.";
		case "mixed-sources":
			return "Those messages come from different places and cannot move together.";
		case "legacy-message":
			return "Messages from before the migration cannot be moved.";
		default:
			return "You are not allowed to move other people's messages.";
	}
};

export type Audience = {
	visibleToRoles?: ReadonlyArray<string>;
	visibleToMembers?: ReadonlyArray<string>;
};

export type AudienceChange = {
	changed: boolean;
	gainedRoles: Array<string>;
	lostRoles: Array<string>;
	gainedMembers: Array<string>;
	lostMembers: Array<string>;
	fromPrivate: boolean;
	toPrivate: boolean;
};

const difference = (
	a: ReadonlyArray<string> | undefined,
	b: ReadonlyArray<string> | undefined,
): Array<string> => {
	const exclude = new Set(b ?? []);
	return (a ?? []).filter((entry) => !exclude.has(entry));
};

export const audienceChange = (
	from: Audience,
	to: Audience,
): AudienceChange => {
	const fromPrivate =
		(from.visibleToRoles?.length ?? 0) > 0 ||
		(from.visibleToMembers?.length ?? 0) > 0;
	const toPrivate =
		(to.visibleToRoles?.length ?? 0) > 0 ||
		(to.visibleToMembers?.length ?? 0) > 0;

	const gainedRoles = difference(to.visibleToRoles, from.visibleToRoles);
	const lostRoles = difference(from.visibleToRoles, to.visibleToRoles);
	const gainedMembers = difference(to.visibleToMembers, from.visibleToMembers);
	const lostMembers = difference(from.visibleToMembers, to.visibleToMembers);

	return {
		changed:
			fromPrivate !== toPrivate ||
			gainedRoles.length > 0 ||
			lostRoles.length > 0 ||
			gainedMembers.length > 0 ||
			lostMembers.length > 0,
		gainedRoles,
		lostRoles,
		gainedMembers,
		lostMembers,
		fromPrivate,
		toPrivate,
	};
};
