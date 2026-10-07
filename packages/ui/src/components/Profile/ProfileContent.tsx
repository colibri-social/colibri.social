import { For, type JSX, Show } from "solid-js";
import { cx } from "../../utils/cx";
import { createSlot } from "../../utils/slot";
import type { Presence } from "../Avatar/Avatar";
import { Chip } from "../Badge/Badge";
import { DeveloperModeCard } from "../DeveloperMode/DeveloperModeCard";
import { IconButton } from "../IconButton/IconButton";
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
	quick?: boolean;
	onSelect?: () => void;
};

export type ProfileDeveloperInfo = {
	copyLabel?: string;
	copyValue: string;
	pdslsHref?: string;
};

export type ProfileData = {
	displayName: string;
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
	statusEditable?: boolean;
	onStatusClick?: JSX.EventHandler<HTMLButtonElement, MouseEvent>;
	nowPlaying?: Omit<NowPlayingCardProps, "tone" | "class">[];
	bio?: JSX.Element;
	roles?: ProfileRole[];
	actionsLabel?: string;
	actions?: ProfileAction[];
	developer?: ProfileDeveloperInfo;
};

export type ProfileContentPartProps = {
	profile: ProfileData;
	surface?: ProfileSurface;
	headingLevel?: 1 | 2 | 3;
	onAction?: (action: ProfileAction) => void;
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

export const ProfileContentHeader = (props: ProfileContentPartProps) => {
	const quickActions = () =>
		(props.profile.actions ?? []).filter((action) => action.quick);

	return (
		<ProfileHeader
			displayName={props.profile.nickname ?? props.profile.displayName}
			nameColor={props.profile.accentColor}
			handle={props.profile.handle}
			pronouns={props.profile.pronouns}
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
			statusEditable={props.profile.statusEditable}
			onStatusClick={props.profile.onStatusClick}
			surface={props.surface ?? "popover"}
			headingLevel={props.headingLevel}
			class={props.class}
			actions={
				quickActions().length > 0 ? (
					<div
						data-profile-quick-actions=""
						class="flex gap-1 rounded-control-lg bg-popover p-1"
					>
						<For each={quickActions()}>
							{(action) => (
								<IconButton
									size="sm"
									variant="ghost"
									class={cx(
										action.tone === "destructive" && "text-destructive",
									)}
									label={action.label}
									icon={renderActionIcon(action.icon)}
									onClick={() => runAction(action, props.onAction)}
								/>
							)}
						</For>
					</div>
				) : undefined
			}
		/>
	);
};

const ProfileSection = (props: { label: string; children: JSX.Element }) => (
	<section data-profile-section={props.label} class="flex flex-col gap-2">
		<SectionLabel label={props.label} />
		{props.children}
	</section>
);

export const ProfileContentBody = (props: ProfileContentPartProps) => {
	const bio = createSlot(() => props.profile.bio);
	const tone = () => (props.surface === "background" ? "card" : "secondary");

	return (
		<div
			data-profile-body=""
			class={cx("flex min-w-0 flex-col gap-4", props.class)}
		>
			<For each={props.profile.nowPlaying ?? []}>
				{(activity) => <NowPlayingCard {...activity} tone={tone()} />}
			</For>
			<Show when={bio.has()}>
				<ProfileSection label="Bio">
					<p class="m-0 text-base break-words text-muted-foreground [&_a]:text-primary-highlight [&_a]:underline-offset-2 [&_a:hover]:underline">
						{bio()}
					</p>
				</ProfileSection>
			</Show>
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
			<Show when={(props.profile.actions ?? []).length > 0}>
				<ListGroup label={props.profile.actionsLabel ?? "Actions"}>
					<For each={props.profile.actions}>
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
			<Show when={props.profile.developer}>
				{(developer) => (
					<DeveloperModeCard
						copyLabel={developer().copyLabel ?? "Copy DID"}
						copyValue={developer().copyValue}
						pdslsHref={developer().pdslsHref}
					/>
				)}
			</Show>
		</div>
	);
};

export const ProfileContent = (props: ProfileContentPartProps) => (
	<div data-profile-content="" class={cx("flex flex-col", props.class)}>
		<ProfileContentHeader
			profile={props.profile}
			surface={props.surface}
			headingLevel={props.headingLevel}
			onAction={props.onAction}
		/>
		<ProfileContentBody
			profile={props.profile}
			surface={props.surface}
			onAction={props.onAction}
			class="px-4 pt-4 pb-4"
		/>
	</div>
);
