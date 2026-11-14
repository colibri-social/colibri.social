import {
	AudiencePicker,
	type ChannelPermissionScope,
	DestructiveRow,
	EMPTY_PERMISSION_OVERRIDE,
	isEmptyPermissionOverride,
	ListGroup,
	type PermissionOverrideEntry,
	PermissionOverrideList,
	type PermissionOverrideTarget,
	PermissionOverrideTargetList,
	type PermissionOverrideValue,
	permissionOverrideTargetName,
	sortPermissionOverrideEntries,
} from "@colibri-social/ui";
import { createMemo, onMount, Show } from "solid-js";
import type { PermissionOverride } from "../../../data/types";
import { defineContract, slot } from "../../../screen/define";
import type { AdminPage } from "../../../shell/layers";
import type { AdminArgs } from "../../../shell/registry";
import { useStack } from "../../../shell/stack";
import { UnsavedBar, type UnsavedForm } from "../../settings/unsaved-form";
import { adminDraft, adminDraftKey, provideAdminDraft } from "../admin-draft";
import { AdminNavHeader } from "../desktop/page-header";
import type { OverrideTargets } from "./override-targets";

export type PermissionTarget = "channel" | "category";

export type PermissionDraft = {
	overrides: () => readonly PermissionOverride[];
	setOverrides: (next: PermissionOverride[]) => void;
	targets: OverrideTargets;
	scope: () => ChannelPermissionScope;
	canChange: (permission: string) => boolean;
	disabled: () => boolean;
	form?: UnsavedForm;
};

const TARGET_SEPARATOR = "~";
const ADD = "add";

const TITLES: Record<PermissionTarget, string> = {
	channel: "Channel permissions",
	category: "Category permissions",
};

const INTRO: Record<PermissionTarget, string> = {
	channel:
		"Allow or deny permissions for a role or a single member in this channel. Inherit keeps what the category and the roles already set.",
	category:
		"Allow or deny permissions for a role or a single member in every channel of this category. Inherit keeps what the roles already set.",
};

const permissionsPage = (target: PermissionTarget): AdminPage =>
	`${target}-permissions`;

const targetPage = (target: PermissionTarget): AdminPage =>
	`${target}-audience`;

const draftKey = (target: PermissionTarget, space: string, id: string) =>
	adminDraftKey(`${target}-permissions`, space, id);

export const providePermissionDraft = (
	target: PermissionTarget,
	space: string,
	id: string,
	draft: PermissionDraft,
) => provideAdminDraft(draftKey(target, space, id), draft);

export const openPermissions = (
	stack: ReturnType<typeof useStack>,
	target: PermissionTarget,
	space: string,
	id: string,
) => stack.push({ kind: "admin", space, page: permissionsPage(target), id });

const overrideKey = (target: { role?: string; member?: string }) => {
	return target.role ? `role:${target.role}` : `member:${target.member}`;
};

const parseTargetId = (id: string | undefined) => {
	const raw = id ?? "";
	const split = raw.indexOf(TARGET_SEPARATOR);
	if (split === -1) return { owner: raw, target: ADD };

	return { owner: raw.slice(0, split), target: raw.slice(split + 1) };
};

const overrideValue = (
	overrides: readonly PermissionOverride[],
	key: string,
): PermissionOverrideValue => {
	const found = overrides.find((override) => overrideKey(override) === key);
	if (!found) return EMPTY_PERMISSION_OVERRIDE;

	return { allow: found.allow ?? [], deny: found.deny ?? [] };
};

const withValue = (
	overrides: readonly PermissionOverride[],
	key: string,
	value: PermissionOverrideValue,
): PermissionOverride[] => {
	const index = overrides.findIndex(
		(override) => overrideKey(override) === key,
	);
	const target = key.startsWith("role:")
		? { role: key.slice("role:".length) }
		: { member: key.slice("member:".length) as PermissionOverride["member"] };
	const next = { ...target, allow: [...value.allow], deny: [...value.deny] };

	if (index === -1) return [...overrides, next];

	return overrides.map((override, position) =>
		position === index ? next : override,
	);
};

const withoutTarget = (
	overrides: readonly PermissionOverride[],
	key: string,
): PermissionOverride[] => {
	return overrides.filter((override) => overrideKey(override) !== key);
};

const useDraft = (target: PermissionTarget, args: AdminArgs, owner: string) => {
	const stack = useStack();
	const draft = createMemo(() =>
		adminDraft<PermissionDraft>(draftKey(target, args.space, owner)),
	);

	onMount(() => {
		if (draft()) return;

		stack.replaceTop({
			kind: "admin",
			space: args.space,
			page: target,
			id: owner,
		});
	});

	return { stack, draft };
};

const entriesOf = (draft: PermissionDraft): PermissionOverrideEntry[] => {
	const overrides = draft.overrides();
	const shown = new Set(overrides.map(overrideKey));
	const fallback = draft.targets.defaultRole();

	if (fallback) shown.add(`role:${fallback}`);

	const entries = [...shown].flatMap((key) => {
		const target = draft.targets.resolve(key);
		return target ? [{ target, value: overrideValue(overrides, key) }] : [];
	});

	return sortPermissionOverrideEntries(entries, draft.targets.position);
};

const targetKey = (target: PermissionOverrideTarget) => {
	return `${target.kind}:${target.id}`;
};

export const createPermissionsContract = (
	id: string,
	target: PermissionTarget,
) =>
	defineContract({
		id,
		model: (args: AdminArgs) => {
			const owner = args.id ?? "";
			const { stack, draft } = useDraft(target, args, owner);
			const push = (suffix: string) =>
				stack.push({
					kind: "admin",
					space: args.space,
					page: targetPage(target),
					id: `${owner}${TARGET_SEPARATOR}${suffix}`,
				});

			return {
				title: TITLES[target],
				intro: INTRO[target],
				draft,
				entries: () => {
					const current = draft();
					return current ? entriesOf(current) : [];
				},
				back: () => stack.pop(),
				open: (entry: PermissionOverrideTarget) => push(targetKey(entry)),
				add: () => push(ADD),
			};
		},
		slots: {
			Header: slot((m) => (
				<AdminNavHeader
					safeTop
					kind="back"
					onNavigate={m.back}
					title={m.title}
				/>
			)),
			Bar: slot((m) => <UnsavedBar form={m.draft()?.form} />),
			Body: slot((m) => (
				<Show when={m.draft()}>
					{(draft) => (
						<div data-permissions-page="" class="flex flex-col gap-4">
							<p class="m-0 text-sm text-pretty text-muted-foreground">
								{m.intro}
							</p>
							<PermissionOverrideTargetList
								entries={m.entries()}
								disabled={draft().disabled()}
								onOpen={m.open}
								onAdd={m.add}
							/>
						</div>
					)}
				</Show>
			)),
		},
	});

export const createAudienceContract = (id: string, target: PermissionTarget) =>
	defineContract({
		id,
		model: (args: AdminArgs) => {
			const parsed = parseTargetId(args.id);
			const { stack, draft } = useDraft(target, args, parsed.owner);
			const adding = parsed.target === ADD;
			const resolved = () => draft()?.targets.resolve(parsed.target);
			const isDefault = () => {
				const current = resolved();
				return current?.kind === "role" && current.isDefault === true;
			};
			const used = (key: string) => {
				const current = draft();
				if (!current) return true;
				if (key === `role:${current.targets.defaultRole()}`) return true;

				return current
					.overrides()
					.some((override) => overrideKey(override) === key);
			};

			const pick = (key: string) => {
				const current = draft();
				if (!current || used(key)) return;

				current.setOverrides(
					withValue(current.overrides(), key, EMPTY_PERMISSION_OVERRIDE),
				);
				stack.replaceTop({
					kind: "admin",
					space: args.space,
					page: targetPage(target),
					id: `${parsed.owner}${TARGET_SEPARATOR}${key}`,
				});
			};

			return {
				adding,
				draft,
				resolved,
				isDefault,
				title: () => {
					if (adding) return "Add role or member";

					const current = resolved();
					return current
						? permissionOverrideTargetName(current)
						: TITLES[target];
				},
				value: () => overrideValue(draft()?.overrides() ?? [], parsed.target),
				editable: () => {
					const current = draft();
					return (
						!!current &&
						!current.disabled() &&
						current.targets.canTarget(parsed.target)
					);
				},
				change: (value: PermissionOverrideValue) => {
					const current = draft();
					if (!current) return;

					current.setOverrides(
						withValue(current.overrides(), parsed.target, value),
					);
				},
				remove: () => {
					const current = draft();
					if (!current) return;

					current.setOverrides(
						withoutTarget(current.overrides(), parsed.target),
					);
					stack.pop();
				},
				canPickRole: (rkey: string) =>
					!used(`role:${rkey}`) && !!draft()?.targets.canTarget(`role:${rkey}`),
				canPickMember: (did: string) =>
					!used(`member:${did}`) &&
					!!draft()?.targets.canTarget(`member:${did}`),
				pickRole: (ids: string[]) => {
					const [rkey] = ids;
					if (rkey) pick(`role:${rkey}`);
				},
				pickMember: (ids: string[]) => {
					const [did] = ids;
					if (did) pick(`member:${did}`);
				},
				back: () => stack.pop(),
			};
		},
		slots: {
			Header: slot((m) => (
				<AdminNavHeader
					safeTop
					kind="back"
					onNavigate={m.back}
					title={m.title()}
				/>
			)),
			Bar: slot((m) => <UnsavedBar form={m.draft()?.form} />),
			Body: slot((m) => (
				<Show when={m.draft()}>
					{(draft) => (
						<Show
							when={!m.adding}
							fallback={
								<div data-override-add="" class="flex flex-col gap-4">
									<AudiencePicker
										searchLabel="Search members and roles"
										roles={draft().targets.roleOptions()}
										members={draft().targets.memberOptions()}
										selectedRoles={[]}
										selectedMembers={[]}
										onRolesChange={m.pickRole}
										onMembersChange={m.pickMember}
										canSelectRole={m.canPickRole}
										canSelectMember={m.canPickMember}
									/>
								</div>
							}
						>
							<div data-override-editor="" class="flex flex-col gap-6">
								<PermissionOverrideList
									scope={draft().scope()}
									value={m.value()}
									onChange={m.change}
									canChange={draft().canChange}
									disabled={!m.editable()}
								/>
								<Show when={!m.isDefault() && m.editable()}>
									<ListGroup>
										<DestructiveRow
											label="Remove override"
											onClick={m.remove}
										/>
									</ListGroup>
								</Show>
							</div>
						</Show>
					)}
				</Show>
			)),
		},
	});

export const cleanOverrides = (
	overrides: readonly PermissionOverride[],
): PermissionOverride[] => {
	return overrides
		.filter(
			(override) =>
				!isEmptyPermissionOverride({
					allow: override.allow ?? [],
					deny: override.deny ?? [],
				}),
		)
		.map((override) => ({
			...(override.role ? { role: override.role } : {}),
			...(override.member ? { member: override.member } : {}),
			allow: [...(override.allow ?? [])].sort(),
			deny: [...(override.deny ?? [])].sort(),
		}));
};

export const sameOverrides = (
	left: readonly PermissionOverride[],
	right: readonly PermissionOverride[],
) => {
	const canonical = (overrides: readonly PermissionOverride[]) =>
		JSON.stringify(
			cleanOverrides(overrides).sort((a, b) =>
				overrideKey(a).localeCompare(overrideKey(b)),
			),
		);

	return canonical(left) === canonical(right);
};
