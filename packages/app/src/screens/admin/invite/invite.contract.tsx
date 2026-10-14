import {
	Button,
	DEFAULT_INVITE_SETTINGS,
	describeInviteUses,
	InviteLinkPanel,
	InviteSettingsForm,
	type InviteSettingsValue,
	inviteExpiryLabel,
	inviteRequestFrom,
	StatusScreen,
} from "@colibri-social/ui";
import { UnlinkIcon } from "@solar-icons/solid/bold/unlink";
import { createMemo, createSignal, Match, Show, Switch } from "solid-js";
import { type InvitationView, inviteUrl } from "../../../data/access";
import { defineContract, slot } from "../../../screen/define";
import { usePlatform } from "../../../screen/platform";
import { NEW_ENTRY } from "../../../shell/layers";
import type { AdminArgs } from "../../../shell/registry";
import { useStack } from "../../../shell/stack";
import { SpaceMissing, toInviteSummary } from "../access-shared";
import { AdminNavHeader } from "../desktop/page-header";
import { SPACE_PERMISSIONS, useAdminSpace } from "../space-admin";

export const INVITE_COPY = {
	newTitle: "Create invite link",
	intro: "Choose how long the link works and how often it can be used.",
	created: "Give this link to anyone you want to join this Space!",
	manage: "You can manage invite links in the Space settings.",
	error: "The invite link couldn't be created. Try again.",
} as const;

export const invite = defineContract({
	id: "adminInvite",
	model: (args: AdminArgs) => {
		const stack = useStack();
		const admin = useAdminSpace(args.space);
		const { data, community, can } = admin;
		const isNew = () => !args.id || args.id === NEW_ENTRY;
		const [settings, setSettings] = createSignal<InviteSettingsValue>(
			DEFAULT_INVITE_SETTINGS,
		);
		const [generating, setGenerating] = createSignal(false);
		const [error, setError] = createSignal<string>();
		const [created, setCreated] = createSignal<InvitationView>();
		const existing = createMemo(() => {
			if (isNew()) return undefined;
			const current = community();
			if (!current) return undefined;
			return data.access
				.invitations(current.did)
				.value()
				?.find((entry) => entry.code === args.id);
		});
		const loadingExisting = () => {
			const current = community();
			return (
				!isNew() && !!current && !data.access.invitations(current.did).value()
			);
		};
		const shown = () => created() ?? existing();
		const generate = async () => {
			const current = community();
			if (!current || generating()) return;
			setGenerating(true);
			setError(undefined);
			try {
				const next = await data.access.createInvitation({
					community: current.did,
					...inviteRequestFrom(settings()),
				});
				setCreated(next);
			} catch {
				setError(INVITE_COPY.error);
			} finally {
				setGenerating(false);
			}
		};
		return {
			...admin,
			back: () => stack.pop(),
			isNew,
			canCreate: () => can(SPACE_PERMISSIONS.createInvite),
			settings,
			setSettings: (value: InviteSettingsValue) => {
				setError(undefined);
				setSettings(value);
			},
			generating,
			error,
			generate,
			shown,
			loadingExisting,
			url: () => {
				const current = shown();
				return current ? inviteUrl(current.code) : "";
			},
		};
	},
	slots: {
		Header: slot((m) => (
			<AdminNavHeader
				safeTop
				kind="back"
				onNavigate={m.back}
				title={m.isNew() ? INVITE_COPY.newTitle : "Invite link"}
			/>
		)),
		Missing: slot(() => <SpaceMissing />),
		Body: slot((m) => (
			<Switch>
				<Match when={m.shown()}>
					{(current) => (
						<div
							data-invite-created={current().code}
							class="flex flex-col gap-4"
						>
							<p class="m-0 text-base text-pretty text-foreground">
								{INVITE_COPY.created}
							</p>
							<InviteLinkPanel
								url={m.url()}
								title={`Join ${m.community()?.name ?? "this Space"} on Colibri`}
							/>
							<p class="m-0 text-sm text-pretty text-muted-foreground">
								{`${inviteExpiryLabel(toInviteSummary(current()), new Date(), true)}. ${describeInviteUses(toInviteSummary(current()))}.`}
							</p>
							<Show when={m.isNew()}>
								<Button block variant="secondary" onClick={m.back}>
									Done
								</Button>
							</Show>
						</div>
					)}
				</Match>
				<Match when={!m.isNew() && !m.loadingExisting()}>
					<StatusScreen
						tone="neutral"
						icon={<UnlinkIcon />}
						title="This invite link doesn't exist anymore"
						description="It may have been deleted."
					/>
				</Match>
				<Match when={m.isNew() && !m.canCreate()}>
					<p class="m-0 text-sm text-muted-foreground">
						You don't have permission to create invite links.
					</p>
				</Match>
				<Match when={m.isNew()}>
					<div class="flex flex-col gap-4">
						<p class="m-0 text-sm text-pretty text-muted-foreground">
							{INVITE_COPY.intro}
						</p>
						<InviteSettingsForm
							platform={usePlatform()()}
							value={m.settings()}
							onChange={m.setSettings}
							onGenerate={() => void m.generate()}
							generating={m.generating()}
							error={m.error()}
						/>
					</div>
				</Match>
			</Switch>
		)),
	},
});
