import { classifyThrown, createLogger } from "@colibri-social/lib";
import {
	Avatar,
	Button,
	Checkbox,
	RadioRow,
	RadioRowGroup,
	SearchField,
	StatusScreen,
	toast,
} from "@colibri-social/ui";
import { DangerTriangleIcon } from "@solar-icons/solid/bold/danger-triangle";
import { createMemo, createSignal, For, Show } from "solid-js";
import { displayNameOf } from "../../../data/adapters/authors";
import { describeError } from "../../../data/error-copy";
import {
	TransferOwnershipError,
	type TransferOwnershipErrorCode,
} from "../../../data/source";
import type { MemberView } from "../../../data/types";
import { defineContract, slot } from "../../../screen/define";
import type { AdminArgs } from "../../../shell/registry";
import { useStack } from "../../../shell/stack";
import { useUnsavedChanges } from "../../../shell/unsaved-changes";
import { PrimaryBadge } from "../../profile/user-badges";
import { AdminNavHeader } from "../desktop/page-header";
import { useAdminSpace } from "../space-admin";

const MAX_RESULTS = 8;

const log = createLogger("admin-transfer");

export const TRANSFER_COPY = {
	warning:
		"Transferring your ownership of this Space means losing all privileges associated with owning it. This can only be undone if the other member transfers the ownership back to you. Read more in our ",
	docsLabel: "documentation",
	docsHref: "https://spaces.colibri.social/docs/",
	acknowledge: "I understand that this action cannot be undone",
	confirm: "Transfer ownership",
	failed: "Couldn't transfer ownership",
	errors: {
		Forbidden: "Only the owner can transfer this Space.",
		CommunityNotFound: "This Space doesn't exist anymore.",
		MemberNotFound: "That person isn't a member of this Space anymore.",
		Banned: "That person is banned from this Space.",
		AlreadyOwner: "That person already owns this Space.",
	} satisfies Record<TransferOwnershipErrorCode, string>,
} as const;

export const transferErrorCopy = (error: unknown) => ({
	title: TRANSFER_COPY.failed,
	description:
		error instanceof TransferOwnershipError
			? TRANSFER_COPY.errors[error.code]
			: describeError(error).description,
});

const matchesQuery = (member: MemberView, query: string) => {
	const needle = query.toLowerCase();
	return [member.nickname, member.actor.displayName, member.actor.handle].some(
		(value) => value?.toLowerCase().includes(needle),
	);
};

export const spaceTransfer = defineContract({
	id: "adminTransfer",
	model: (args: AdminArgs) => {
		const stack = useStack();
		const admin = useAdminSpace(args.space);
		const { data, community } = admin;
		const members = createMemo(() => {
			const current = community();
			return current ? (data.space(current).members.value() ?? []) : [];
		});
		const [query, setQuery] = createSignal("");
		const [selected, setSelected] = createSignal<string>();
		const [acknowledged, setAcknowledged] = createSignal(false);
		const [transferring, setTransferring] = createSignal(false);
		const candidates = createMemo(() =>
			members().filter((member) => member.actor.did !== data.viewer.did),
		);
		const selectedMember = () =>
			candidates().find((member) => member.actor.did === selected());
		const results = createMemo(() => {
			const trimmed = query().trim();
			const pinned = selectedMember();
			const found = trimmed
				? candidates()
						.filter(
							(member) =>
								member.actor.did !== pinned?.actor.did &&
								matchesQuery(member, trimmed),
						)
						.slice(0, MAX_RESULTS)
				: [];
			return pinned ? [pinned, ...found] : found;
		});
		const ready = () => !!selectedMember() && acknowledged() && !transferring();
		useUnsavedChanges({
			depth: () =>
				stack
					.mounted()
					.findIndex(
						(layer) =>
							layer.kind === "admin" &&
							layer.page === "transfer" &&
							layer.space === args.space,
					) + 1,
			dirty: () => !transferring() && (!!selected() || acknowledged()),
			description: () => "Ownership stays with you.",
		});
		const transfer = async () => {
			const current = community();
			const target = selectedMember();
			if (!current || !target || !ready()) return;
			setTransferring(true);
			try {
				await data.community.transferOwnership(current.did, target.actor.did);
				toast.success(
					`${displayNameOf(target.actor, target)} now owns ${current.name}`,
				);
				stack.pop();
			} catch (error) {
				log.warn("transfer failed", {
					code:
						error instanceof TransferOwnershipError
							? error.code
							: classifyThrown(error).code,
				});
				const copy = transferErrorCopy(error);
				toast.error(copy.title, { description: copy.description });
			} finally {
				setTransferring(false);
			}
		};
		return {
			...admin,
			back: () => stack.pop(),
			allowed: () => !!community()?.viewer.isOwner,
			loadingMembers: () => {
				const current = community();
				return current ? data.space(current).members.loading() : false;
			},
			query,
			setQuery,
			results,
			selected,
			setSelected,
			acknowledged,
			setAcknowledged,
			transferring,
			ready,
			transfer,
		};
	},
	slots: {
		Header: slot((m) => (
			<AdminNavHeader
				safeTop
				kind="back"
				onNavigate={m.back}
				title="Transfer ownership"
			/>
		)),
		Missing: slot((m) => (
			<Show
				when={m.missing()}
				fallback={
					<StatusScreen
						tone="neutral"
						icon={<DangerTriangleIcon />}
						title="Only the owner can do this"
						description="Ownership can only be transferred by the current owner of the Space."
					/>
				}
			>
				<StatusScreen
					tone="destructive"
					icon={<DangerTriangleIcon />}
					title="This Space isn't available"
					description="It may have been deleted, or you're no longer a member."
				/>
			</Show>
		)),
		Warning: slot(() => (
			<div
				data-transfer-warning=""
				class="rounded-control border border-destructive bg-destructive/15 p-4"
			>
				<p class="m-0 text-sm text-muted-foreground">
					{TRANSFER_COPY.warning}
					<a
						href={TRANSFER_COPY.docsHref}
						target="_blank"
						rel="noreferrer"
						class="focus-ring text-foreground underline-offset-2 hover:underline"
					>
						{TRANSFER_COPY.docsLabel}
					</a>
					.
				</p>
			</div>
		)),
		Picker: slot((m) => (
			<div class="flex flex-col gap-2">
				<SearchField
					label="New owner"
					placeholder="Search members..."
					value={m.query()}
					onChange={m.setQuery}
					disabled={m.transferring()}
				/>
				<Show when={m.results().length > 0}>
					<RadioRowGroup
						aria-label="Members"
						value={m.selected() ?? ""}
						onChange={m.setSelected}
						disabled={m.transferring()}
					>
						<For each={m.results()}>
							{(member) => (
								<RadioRow
									value={member.actor.did}
									icon={
										<Avatar
											size="sm"
											name={displayNameOf(member.actor, member)}
											src={member.actor.avatar}
											seed={member.actor.did}
										/>
									}
									title={
										<span class="flex min-w-0 items-center gap-1">
											<span class="truncate">
												{displayNameOf(member.actor, member)}
											</span>
											<PrimaryBadge profile={member.actor} />
										</span>
									}
									description={`@${member.actor.handle}`}
								/>
							)}
						</For>
					</RadioRowGroup>
				</Show>
				<Show
					when={
						m.query().trim() && m.results().length === 0 && !m.loadingMembers()
					}
				>
					<p class="m-0 px-1 text-sm text-muted-foreground">
						No members match your search.
					</p>
				</Show>
			</div>
		)),
		Confirm: slot((m) => (
			<div class="flex flex-col gap-4">
				<Checkbox
					label={TRANSFER_COPY.acknowledge}
					checked={m.acknowledged()}
					onChange={m.setAcknowledged}
					disabled={m.transferring()}
				/>
				<Button
					variant="destructive"
					block
					disabled={!m.ready() && !m.transferring()}
					loading={m.transferring()}
					onClick={() => void m.transfer()}
				>
					{TRANSFER_COPY.confirm}
				</Button>
			</div>
		)),
	},
});
