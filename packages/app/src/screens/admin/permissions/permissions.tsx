import {
	AudiencePicker,
	ListGroup,
	NavRow,
	ToggleRow,
} from "@colibri-social/ui";
import { EyeIcon } from "@solar-icons/solid/bold/eye";
import { PenNewSquareIcon } from "@solar-icons/solid/bold/pen-new-square";
import { createMemo, onMount, Show } from "solid-js";
import { defineContract, slot } from "../../../screen/define";
import type { AdminPage } from "../../../shell/layers";
import type { AdminArgs } from "../../../shell/registry";
import { useStack } from "../../../shell/stack";
import { adminDraft, adminDraftKey, provideAdminDraft } from "../admin-draft";
import {
	type Audience,
	type AudienceKind,
	type AudienceOptions,
	audienceSummary,
} from "../channel/audience";
import { AdminNavHeader } from "../desktop/page-header";

export type PermissionTarget = "channel" | "category";

export type PermissionDraft = {
	ownerOnly: () => boolean;
	setOwnerOnly?: (ownerOnly: boolean) => void;
	audience: (kind: AudienceKind) => Audience;
	setAudience: (kind: AudienceKind, audience: Audience) => void;
	options: AudienceOptions;
	disabled: () => boolean;
};

const AUDIENCE_SEPARATOR = "~";

const COPY: Record<
	PermissionTarget,
	{
		title: string;
		ownerOnly: string;
		empty: Record<AudienceKind, string>;
	}
> = {
	channel: {
		title: "Channel permissions",
		ownerOnly: "Only you can chat here.",
		empty: {
			visible:
				"No roles or members specified. Every member will be able to see this channel!",
			post: "No roles or members specified. Everyone will be allowed to chat here!",
		},
	},
	category: {
		title: "Category permissions",
		ownerOnly: "Only you can chat in this category's channels.",
		empty: {
			visible:
				"No roles or members specified. Every member will be able to see this category!",
			post: "No roles or members specified. Everyone will be allowed to chat in its channels!",
		},
	},
};

export const AUDIENCE_TITLE: Record<AudienceKind, string> = {
	visible: "Who can see it",
	post: "Who can post in it",
};

const permissionsPage = (target: PermissionTarget): AdminPage =>
	`${target}-permissions`;

const audiencePage = (target: PermissionTarget): AdminPage =>
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

const parseAudienceId = (id: string | undefined) => {
	const raw = id ?? "";
	const split = raw.lastIndexOf(AUDIENCE_SEPARATOR);
	const kind = raw.slice(split + 1);
	return {
		owner: split === -1 ? raw : raw.slice(0, split),
		kind: (kind === "post" ? "post" : "visible") as AudienceKind,
	};
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

export const createPermissionsContract = (
	id: string,
	target: PermissionTarget,
) =>
	defineContract({
		id,
		model: (args: AdminArgs) => {
			const owner = args.id ?? "";
			const { stack, draft } = useDraft(target, args, owner);
			const locked = () => {
				const current = draft();
				return !current || current.disabled() || current.ownerOnly();
			};
			return {
				copy: COPY[target],
				draft,
				locked,
				back: () => stack.pop(),
				pick: (kind: AudienceKind) =>
					stack.push({
						kind: "admin",
						space: args.space,
						page: audiencePage(target),
						id: `${owner}${AUDIENCE_SEPARATOR}${kind}`,
					}),
			};
		},
		slots: {
			Header: slot((m) => (
				<AdminNavHeader
					safeTop
					kind="back"
					onNavigate={m.back}
					title={m.copy.title}
				/>
			)),
			Body: slot((m) => (
				<Show when={m.draft()}>
					{(draft) => (
						<div data-permissions-page="" class="flex flex-col gap-6">
							<Show when={draft().setOwnerOnly}>
								{(setOwnerOnly) => (
									<ListGroup>
										<ToggleRow
											title="Owner-only"
											description={m.copy.ownerOnly}
											checked={draft().ownerOnly()}
											onChange={(checked) => setOwnerOnly()(checked)}
											disabled={draft().disabled()}
										/>
									</ListGroup>
								)}
							</Show>
							<ListGroup>
								<NavRow
									icon={<EyeIcon />}
									label={AUDIENCE_TITLE.visible}
									value={audienceSummary(draft().audience("visible"))}
									disabled={m.locked()}
									onClick={() => m.pick("visible")}
								/>
								<NavRow
									icon={<PenNewSquareIcon />}
									label={AUDIENCE_TITLE.post}
									value={audienceSummary(draft().audience("post"))}
									disabled={m.locked()}
									onClick={() => m.pick("post")}
								/>
							</ListGroup>
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
			const parsed = parseAudienceId(args.id);
			const { stack, draft } = useDraft(target, args, parsed.owner);
			const selected = () => draft()?.audience(parsed.kind);
			const empty = () => {
				const current = selected();
				return (
					!current ||
					(current.roles.length === 0 && current.members.length === 0)
				);
			};
			return {
				kind: parsed.kind,
				copy: COPY[target],
				draft,
				selected,
				empty,
				back: () => stack.pop(),
				change: (next: Partial<Audience>) => {
					const current = draft();
					const base = selected();
					if (!current || !base) return;
					current.setAudience(parsed.kind, { ...base, ...next });
				},
			};
		},
		slots: {
			Header: slot((m) => (
				<AdminNavHeader
					safeTop
					kind="back"
					onNavigate={m.back}
					title={AUDIENCE_TITLE[m.kind]}
				/>
			)),
			Body: slot((m) => (
				<Show when={m.draft()}>
					{(draft) => (
						<div data-audience-page={m.kind} class="flex flex-col gap-4">
							<p class="m-0 text-sm text-pretty text-muted-foreground">
								{m.empty()
									? m.copy.empty[m.kind]
									: "Only the roles and members you pick are allowed."}
							</p>
							<AudiencePicker
								searchLabel="Search members and roles"
								roles={draft().options.roles()}
								members={draft().options.members()}
								selectedRoles={m.selected()?.roles ?? []}
								selectedMembers={m.selected()?.members ?? []}
								onRolesChange={(roles) => m.change({ roles })}
								onMembersChange={(members) => m.change({ members })}
								canSelectRole={draft().options.canSelectRole}
								canSelectMember={draft().options.canSelectMember}
							/>
						</div>
					)}
				</Show>
			)),
		},
	});
