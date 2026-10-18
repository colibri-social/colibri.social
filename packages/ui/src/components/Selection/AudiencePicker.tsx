import { createMemo, createSignal, For, Show } from "solid-js";
import { cx } from "../../utils/cx";
import { foldText } from "../../utils/fold-text";
import { SectionLabel } from "../List/List";
import type { MemberIdentityData } from "../Members/MemberIdentity";
import type { RoleIdentity } from "../Roles/RoleBadge";
import { matchesMember } from "../Roles/RoleMembers";
import { SearchField } from "../TextField/TextField";
import { MemberSelectRow, RoleSelectRow } from "./SelectionRows";

export const AUDIENCE_MEMBER_LIMIT = 100;

export type AudienceRole = RoleIdentity & { id: string };

export type AudiencePickerProps = {
	roles: readonly AudienceRole[];
	members: readonly MemberIdentityData[];
	selectedRoles: readonly string[];
	selectedMembers: readonly string[];
	onRolesChange: (ids: string[]) => void;
	onMembersChange: (ids: string[]) => void;
	canSelectRole?: (id: string) => boolean;
	canSelectMember?: (id: string) => boolean;
	searchLabel?: string;
	memberLimit?: number;
	class?: string;
};

const toggled = (list: readonly string[], id: string, on: boolean) => {
	const rest = list.filter((entry) => entry !== id);
	return on ? [...rest, id] : rest;
};

export const AudiencePicker = (props: AudiencePickerProps) => {
	const [query, setQuery] = createSignal("");
	const needle = () => foldText(query().trim());
	const visibleRoles = createMemo(() =>
		props.roles.filter((role) => foldText(role.name).includes(needle())),
	);
	const [pinnedSnapshot, setPinnedSnapshot] =
		createSignal<ReadonlySet<string>>();
	const [touched, setTouched] = createSignal<ReadonlySet<string>>(new Set());
	const pinned = () => pinnedSnapshot() ?? new Set(props.selectedMembers);
	const toggleMember = (id: string, on: boolean) => {
		if (!pinnedSnapshot()) setPinnedSnapshot(new Set(props.selectedMembers));
		setTouched((current) => new Set(current).add(id));
		props.onMembersChange(toggled(props.selectedMembers, id, on));
	};
	const matchingMembers = createMemo(() => {
		const matches = props.members.filter((member) =>
			matchesMember(member, query()),
		);
		const first = pinned();
		return [
			...matches.filter((member) => first.has(member.id)),
			...matches.filter((member) => !first.has(member.id)),
		];
	});
	const limit = () => props.memberLimit ?? AUDIENCE_MEMBER_LIMIT;
	const visibleMembers = createMemo(() => {
		const first = pinned();
		const kept = touched();
		const selected = new Set(props.selectedMembers);
		return matchingMembers().filter(
			(member, index) =>
				index < limit() ||
				first.has(member.id) ||
				kept.has(member.id) ||
				selected.has(member.id),
		);
	});
	const truncated = () => matchingMembers().length > visibleMembers().length;
	const label = () => props.searchLabel ?? "Search members and roles";

	return (
		<div data-audience-picker="" class={cx("flex flex-col gap-6", props.class)}>
			<SearchField
				aria-label={label()}
				placeholder={`${label()}...`}
				value={query()}
				onChange={setQuery}
			/>
			<Show when={visibleRoles().length > 0}>
				<section data-section="roles" class="flex flex-col gap-2">
					<SectionLabel label="Roles" />
					<div class="flex flex-col">
						<For each={visibleRoles()}>
							{(role) => (
								<RoleSelectRow
									role={role}
									disabled={props.canSelectRole?.(role.id) === false}
									checked={props.selectedRoles.includes(role.id)}
									onChange={(on) =>
										props.onRolesChange(
											toggled(props.selectedRoles, role.id, on),
										)
									}
								/>
							)}
						</For>
					</div>
				</section>
			</Show>
			<Show when={visibleMembers().length > 0}>
				<section data-section="members" class="flex flex-col gap-2">
					<SectionLabel label="Members" />
					<div class="flex flex-col">
						<For each={visibleMembers()}>
							{(member) => (
								<MemberSelectRow
									member={member}
									disabled={props.canSelectMember?.(member.id) === false}
									checked={props.selectedMembers.includes(member.id)}
									onChange={(on) => toggleMember(member.id, on)}
								/>
							)}
						</For>
					</div>
					<Show when={truncated()}>
						<p class="m-0 text-center text-xs text-muted-foreground">
							Search to find more members.
						</p>
					</Show>
				</section>
			</Show>
			<Show when={visibleRoles().length === 0 && visibleMembers().length === 0}>
				<p class="m-0 py-6 text-center text-sm text-muted-foreground">
					{query().trim()
						? `No roles or members match "${query().trim()}".`
						: "There are no roles or members to pick from."}
				</p>
			</Show>
		</div>
	);
};
