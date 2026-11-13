import { For, type JSX, Show, splitProps } from "solid-js";
import { cx } from "../../utils/cx";
import { createSlot } from "../../utils/slot";
import type { Presence } from "../Avatar/Avatar";
import { Chip } from "../Badge/Badge";
import { DeveloperModeCard } from "../DeveloperMode/DeveloperModeCard";
import type { CustomEmoji } from "../EmojiPicker/EmojiPicker";
import { DestructiveRow, ListGroup, NavRow, SectionLabel } from "../List/List";
import {
	NowPlayingCard,
	type NowPlayingCardProps,
	ProfileHeader,
	type ProfileHeaderLink,
	type ProfileSurface,
} from "./Profile";

export type ProfileRole = {
	name: string;
	color?: string;
	icon?: JSX.Element;
};

export type ProfileAction = {
	label: string;
	icon?: JSX.Element | (() => JSX.Element);
	tone?: "default" | "destructive";
	onSelect?: () => void;
};

export type ProfileDeveloperInfo = {
	copyLabel?: string;
	copyValue: string;
	pdslsHref?: string;
};

export type ProfileData = {
	displayName: string;
	avatarSeed?: string;
	nickname?: string;
	handle: string;
	pronouns?: string;
	accentColor?: string;
	avatarSrc?: string;
	avatarColor?: string;
	presence?: Presence;
	bannerSrc?: string;
	bannerColor?: string;
	badge?: JSX.Element;
	appBadge?: JSX.Element;
	links?: ProfileHeaderLink[];
	status?: JSX.Element;
	statusEmoji?: string;
	statusCustomEmoji?: CustomEmoji;
	statusEditable?: boolean;
	statusShowWhileOffline?: boolean;
	onStatusClick?: JSX.EventHandler<HTMLButtonElement, MouseEvent>;
	onStatusCustomEmojiClick?: (emoji: CustomEmoji, anchor: HTMLElement) => void;
	nowPlaying?: Omit<NowPlayingCardProps, "tone" | "class">[];
	activityPrompt?: JSX.Element;
	bio?: JSX.Element;
	roles?: ProfileRole[];
	actionsLabel?: string;
	actions?: ProfileAction[];
	developer?: ProfileDeveloperInfo;
	self?: boolean;
	blocked?: boolean;
	onUnblock?: () => void;
};

export type ProfileContentPartProps = {
	profile: ProfileData;
	surface?: ProfileSurface;
	tight?: boolean;
	headingLevel?: 1 | 2 | 3;
	onAction?: (action: ProfileAction) => void;
	headerActions?: JSX.Element;
	showActions?: boolean;
	showDeveloper?: boolean;
	footer?: JSX.Element;
	avatarPlay?: boolean;
	class?: string;
};

const renderActionIcon = (icon: ProfileAction["icon"]): JSX.Element => {
	if (typeof icon === "function") return icon();
	if (icon instanceof Node) return icon.cloneNode(true) as Node as JSX.Element;
	return icon;
};

const runAction = (
	action: ProfileAction,
	onAction: ((action: ProfileAction) => void) | undefined,
) => {
	onAction?.(action);
	action.onSelect?.();
};

export const profileActionsOf = (profile: ProfileData) =>
	profile.self ? [] : (profile.actions ?? []);

export const ProfileContentHeader = (props: ProfileContentPartProps) => (
	<ProfileHeader
		displayName={props.profile.nickname ?? props.profile.displayName}
		nameColor={props.profile.accentColor}
		handle={props.profile.handle}
		pronouns={props.profile.pronouns}
		avatarSeed={props.profile.avatarSeed}
		avatarSrc={props.profile.avatarSrc}
		avatarColor={props.profile.avatarColor}
		presence={props.profile.presence}
		bannerSrc={props.profile.bannerSrc}
		bannerColor={props.profile.bannerColor}
		badge={props.profile.badge}
		appBadge={props.profile.appBadge}
		links={props.profile.links}
		status={props.profile.status}
		statusEmoji={props.profile.statusEmoji}
		statusCustomEmoji={props.profile.statusCustomEmoji}
		statusEditable={props.profile.statusEditable}
		statusShowWhileOffline={props.profile.statusShowWhileOffline}
		onStatusClick={props.profile.onStatusClick}
		onStatusCustomEmojiClick={props.profile.onStatusCustomEmojiClick}
		avatarPlay={props.avatarPlay}
		surface={props.surface ?? "popover"}
		tight={props.tight}
		headingLevel={props.headingLevel}
		class={props.class}
		actions={props.headerActions}
	/>
);

const ProfileSection = (props: { label: string; children: JSX.Element }) => (
	<section data-profile-section={props.label} class="flex flex-col gap-2">
		<SectionLabel label={props.label} />
		{props.children}
	</section>
);

export const ProfileBio = (
	props: { children: JSX.Element } & JSX.HTMLAttributes<HTMLParagraphElement>,
) => {
	const [local, rest] = splitProps(props, ["children", "class"]);
	return (
		<ProfileSection label="Bio">
			<p
				{...rest}
				class={cx(
					"m-0 text-base break-words text-foreground select-text [&_a]:text-primary-highlight [&_a]:underline-offset-2 [&_a:hover]:underline",
					local.class,
				)}
			>
				{local.children}
			</p>
		</ProfileSection>
	);
};

export const ProfileContentBody = (props: ProfileContentPartProps) => {
	const bio = createSlot(() => props.profile.bio);
	const activityPrompt = createSlot(() => props.profile.activityPrompt);
	const footer = createSlot(() => props.footer);
	const tone = () => (props.surface === "background" ? "card" : "secondary");
	const actions = () =>
		props.showActions === false ? [] : profileActionsOf(props.profile);
	const developer = () =>
		props.showDeveloper === false ? undefined : props.profile.developer;
	const hasContent = () =>
		bio.has() ||
		(props.profile.nowPlaying ?? []).length > 0 ||
		activityPrompt.has() ||
		(props.profile.roles ?? []).length > 0 ||
		actions().length > 0 ||
		!!developer() ||
		footer.has();

	return (
		<Show when={hasContent()}>
			<div
				data-profile-body=""
				class={cx("flex min-w-0 flex-col gap-4", props.class)}
			>
				<Show when={bio.has()}>
					<ProfileBio>{bio()}</ProfileBio>
				</Show>
				<For each={props.profile.nowPlaying ?? []}>
					{(activity) => <NowPlayingCard {...activity} tone={tone()} />}
				</For>
				<Show when={activityPrompt.has()}>{activityPrompt()}</Show>
				<Show when={(props.profile.roles ?? []).length > 0}>
					<ProfileSection label="Space roles">
						<div class="flex flex-wrap gap-1">
							<For each={props.profile.roles}>
								{(role) => (
									<Chip
										icon={
											role.icon ?? (
												<span
													aria-hidden="true"
													class="block size-2 rounded-full"
													style={{
														background: role.color ?? "var(--foreground)",
													}}
												/>
											)
										}
									>
										{role.name}
									</Chip>
								)}
							</For>
						</div>
					</ProfileSection>
				</Show>
				<Show when={actions().length > 0}>
					<ListGroup label={props.profile.actionsLabel ?? "Actions"}>
						<For each={actions()}>
							{(action) => (
								<Show
									when={action.tone === "destructive"}
									fallback={
										<NavRow
											icon={renderActionIcon(action.icon)}
											label={action.label}
											onClick={() => runAction(action, props.onAction)}
										/>
									}
								>
									<DestructiveRow
										icon={renderActionIcon(action.icon)}
										label={action.label}
										onClick={() => runAction(action, props.onAction)}
									/>
								</Show>
							)}
						</For>
					</ListGroup>
				</Show>
				<Show when={developer()}>
					{(developer) => (
						<DeveloperModeCard
							copyLabel={developer().copyLabel ?? "Copy DID"}
							copyValue={developer().copyValue}
							pdslsHref={developer().pdslsHref}
						/>
					)}
				</Show>
				<Show when={footer.has()}>
					<div data-profile-footer="" class="flex flex-col">
						{footer()}
					</div>
				</Show>
			</div>
		</Show>
	);
};

export const ProfileContent = (props: ProfileContentPartProps) => (
	<div data-profile-content="" class={cx("flex flex-col pb-4", props.class)}>
		<ProfileContentHeader
			profile={props.profile}
			surface={props.surface}
			tight={props.tight}
			headingLevel={props.headingLevel}
			avatarPlay={props.avatarPlay}
			headerActions={props.headerActions}
		/>
		<ProfileContentBody
			profile={props.profile}
			surface={props.surface}
			onAction={props.onAction}
			showActions={props.showActions}
			showDeveloper={props.showDeveloper}
			footer={props.footer}
			class="px-4 pt-4"
		/>
	</div>
);
