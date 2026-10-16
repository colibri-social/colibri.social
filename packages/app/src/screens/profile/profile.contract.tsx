import {
	DeveloperModeCard,
	ListGroup,
	NavRow,
	NowPlayingCard,
	OwnPresenceRow,
	OwnProfileRows,
	ownPresenceEntries,
	PresenceDrawer,
	ProfileBio,
	ProfileHeader,
	presenceLabels,
	toast,
	type Presence as UiPresence,
} from "@colibri-social/ui";
import { EmojiFunnyCircleIcon } from "@solar-icons/solid/bold/emoji-funny-circle";
import { PenIcon } from "@solar-icons/solid/bold/pen";
import { createMemo, createSignal, For, Show, untrack } from "solid-js";
import { nowPlayingOf } from "../../data/activity";
import { displayNameOf } from "../../data/adapters/authors";
import { profileBannerFill } from "../../data/profile-theme";
import { useData } from "../../data/store";
import type { Presence } from "../../data/types";
import { defineContract, slot } from "../../screen/define";
import { useStack } from "../../shell/stack";
import { uiPresence } from "../members/member-adapter";
import { OwnActivityPrompt } from "./activity-prompt";
import { createBioRenderer } from "./bio-links";
import { blueskyProfileLinks } from "./bluesky-link";
import { StatusEditor } from "./status-editor";
import { PrimaryBadge, SecondaryBadges } from "./user-badges";

type Platform = { platform?: "mobile" | "desktop" };

const ONLINE_STATE: Record<UiPresence, Presence["onlineState"]> = {
	online: "online",
	idle: "away",
	dnd: "dnd",
	offline: "offline",
};

export const profile = defineContract({
	id: "profile",
	model: (_args: Record<string, never>) => {
		const data = useData();
		const stack = useStack();
		const viewer = data.viewer;
		const presence = () => data.presenceOf(viewer.did) ?? viewer.presence;
		const status = () => presence()?.status;
		const [statusOpen, setStatusOpen] = createSignal(false);
		const [presenceOpen, setPresenceOpen] = createSignal(false);
		const selectPresence = (next: UiPresence) =>
			data
				.setOnlineState(ONLINE_STATE[next])
				.catch(() => toast.error("Couldn't change your online status"));
		const presenceItems = createMemo(() =>
			ownPresenceEntries(uiPresence(presence()), (next) => {
				if (next !== uiPresence(untrack(presence))) void selectPresence(next);
			}),
		);
		return {
			data,
			presenceItems,
			presenceOpen,
			setPresenceOpen,
			selectPresence,
			viewer,
			presence,
			status,
			statusOpen,
			setStatusOpen,
			editProfile: () => stack.push({ kind: "editProfile" }),
		};
	},
	slots: {
		Header: slot((m, p: Platform) => (
			<ProfileHeader
				displayName={displayNameOf(m.viewer)}
				handle={m.viewer.handle}
				pronouns={m.viewer.pronouns}
				avatarSrc={m.viewer.avatar}
				avatarSeed={m.viewer.did}
				nameColor={m.viewer.theme?.accentColor}
				bannerSrc={m.viewer.banner}
				bannerColor={profileBannerFill(m.viewer.theme)}
				links={blueskyProfileLinks(m.data.preferences, m.viewer.did)}
				presence={uiPresence(m.presence())}
				badge={<PrimaryBadge profile={m.viewer} size="sm" />}
				appBadge={<SecondaryBadges profile={m.viewer} />}
				status={m.status()?.text || undefined}
				statusEmoji={m.status()?.emoji}
				statusShowWhileOffline={m.status()?.showWhileOffline}
				statusEditable
				onStatusClick={() => m.setStatusOpen(true)}
				onAvatarClick={
					p.platform === "desktop" ? undefined : () => m.setPresenceOpen(true)
				}
				avatarLabel={
					p.platform === "desktop"
						? undefined
						: `Change your online status, currently ${presenceLabels[uiPresence(m.presence())]}`
				}
				surface={p.platform === "desktop" ? "popover" : "background"}
				headingLevel={p.platform === "desktop" ? 2 : 1}
			/>
		)),
		Actions: slot((m, p: Platform) => (
			<Show
				when={p.platform === "desktop"}
				fallback={
					<ListGroup>
						<NavRow
							icon={<PenIcon />}
							label="Edit profile"
							onClick={m.editProfile}
						/>
						<NavRow
							icon={<EmojiFunnyCircleIcon />}
							label={m.status() ? "Edit status" : "Set a status"}
							onClick={() => m.setStatusOpen(true)}
						/>
					</ListGroup>
				}
			>
				<OwnProfileRows
					hasStatus={!!m.status()}
					onEditProfile={m.editProfile}
					onEditStatus={() => m.setStatusOpen(true)}
				/>
			</Show>
		)),
		Activity: slot((m) => {
			const links = createBioRenderer();
			return (
				<>
					<For each={nowPlayingOf(m.presence(), links.openLink) ?? []}>
						{(activity) => <NowPlayingCard {...activity} tone="card" />}
					</For>
					<OwnActivityPrompt tone="card" />
					<links.LinkWarningOutlet />
				</>
			);
		}),
		Bio: slot((m) => {
			const bio = createBioRenderer();
			return (
				<Show when={bio.render(m.viewer.description)}>
					{(content) => (
						<>
							<ProfileBio data-own-bio="">{content()}</ProfileBio>
							<bio.LinkWarningOutlet />
						</>
					)}
				</Show>
			);
		}),
		Developer: slot((m) => (
			<Show when={m.data.controls().developerMode}>
				<DeveloperModeCard
					copyLabel="Copy DID"
					copyValue={m.viewer.did}
					pdslsHref={`https://pdsls.dev/at://${m.viewer.did}`}
				/>
			</Show>
		)),
		PresencePicker: slot((m, p: Platform) => (
			<Show
				when={p.platform === "desktop"}
				fallback={
					<PresenceDrawer
						open={m.presenceOpen()}
						onOpenChange={m.setPresenceOpen}
						value={uiPresence(m.presence())}
						onChange={m.selectPresence}
					/>
				}
			>
				<OwnPresenceRow
					presence={uiPresence(m.presence())}
					entries={m.presenceItems()}
				/>
			</Show>
		)),
		StatusEditor: slot((m, p: Platform) => (
			<StatusEditor
				open={m.statusOpen()}
				onOpenChange={m.setStatusOpen}
				platform={p.platform}
			/>
		)),
	},
});
