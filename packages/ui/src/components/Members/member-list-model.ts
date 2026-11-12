import { type Accessor, createSignal } from "solid-js";
import type { Member, MemberGroup } from "./MemberList";

export type MemberListRow =
	| { kind: "header"; key: string; group: MemberGroup; first: boolean }
	| {
			kind: "member";
			key: string;
			member: Member;
			group: MemberGroup;
			first: boolean;
			last: boolean;
	  };

export type StableMemberRow = {
	key: string;
	row: Accessor<MemberListRow>;
	current: MemberListRow;
	set: (row: MemberListRow) => void;
};

export const flattenMemberGroups = (
	groups: readonly MemberGroup[],
): MemberListRow[] => {
	const rows: MemberListRow[] = [];
	groups.forEach((group, groupIndex) => {
		rows.push({
			kind: "header",
			key: `group:${group.id}`,
			group,
			first: groupIndex === 0,
		});
		group.members.forEach((member, index) => {
			rows.push({
				kind: "member",
				key: `member:${member.id}`,
				member,
				group,
				first: index === 0,
				last: index === group.members.length - 1,
			});
		});
	});
	return rows;
};

export const countMemberRows = (groups: readonly MemberGroup[]) =>
	groups.reduce((total, group) => total + 1 + group.members.length, 0);

export const sameMemberRow = (a: MemberListRow, b: MemberListRow) => {
	if (a.kind !== b.kind || a.key !== b.key || a.first !== b.first) return false;
	if (a.kind === "header" && b.kind === "header")
		return (
			a.group.label === b.group.label &&
			a.group.kind === b.group.kind &&
			a.group.role === b.group.role &&
			a.group.members.length === b.group.members.length
		);
	if (a.kind === "member" && b.kind === "member")
		return (
			a.member === b.member &&
			a.last === b.last &&
			(a.group.kind === "offline") === (b.group.kind === "offline")
		);
	return false;
};

export const sameKeys = (a: readonly string[], b: readonly string[]) =>
	a.length === b.length && a.every((key, index) => key === b[index]);

export const createStableMemberRows = () => {
	const rowsByKey = new Map<string, StableMemberRow>();

	return (flat: readonly MemberListRow[]) => {
		const present = new Set<string>();
		const rows = flat.map((row) => {
			present.add(row.key);
			const existing = rowsByKey.get(row.key);
			if (existing) {
				if (!sameMemberRow(existing.current, row)) {
					existing.current = row;
					existing.set(row);
				}
				return existing;
			}

			const [read, write] = createSignal(row, { equals: sameMemberRow });
			const stable: StableMemberRow = {
				key: row.key,
				row: read,
				current: row,
				set: write,
			};

			rowsByKey.set(row.key, stable);
			return stable;
		});

		for (const key of rowsByKey.keys()) {
			if (!present.has(key)) rowsByKey.delete(key);
		}

		return rows;
	};
};
