import type { ActorData } from "@colibri-social/lib";
import {
	type Component,
	createSignal,
	For,
	type JSX,
	type ParentComponent,
	Show,
} from "solid-js";
import { Dynamic } from "solid-js/web";
import PencilSimpleIcon from "~icons/ph/pencil-simple";
import {
	type BlueskyClientID,
	getBskyAlternativeClientInfo,
} from "../../../atproto/bluesky-alternatives";
import { buildBskyProfileUrl } from "../../../atproto/bsky-post-url";
import { resolveBlob } from "../../../atproto/resolve-blob";
import { useCommunityContext } from "../../../contexts/Community";
import { useSettingsModalContext } from "../../../contexts/SettingsModal";
import { useUserContext } from "../../../contexts/User";
import { useUserPreferences } from "../../../contexts/UserPreferences";
import { cx } from "../../../utils/cva";
import { parseEmojiText } from "../../../utils/emoji";
import { LINK_REGEX } from "../../../utils/link-regex";
import { useIsMobile } from "../../../utils/mobile-pane";
import {
	handleExternalLinkClick,
	openExternalLink,
} from "../../../utils/open-external-link";
import { purify } from "../../..//utils/purify";
import { readableUserColor } from "../../../utils/readable-color";
import { resolvedTheme } from "../../../utils/theme";
import { useUserBadges } from "../../../utils/user-badges";
import { BottomSheet } from "../../ui/MenuDrawer";
import {
	Popover,
	PopoverContent,
	PopoverPortal,
	type PopoverProps,
	PopoverTrigger,
} from "../../ui/Popover";
import {
	Tooltip,
	TooltipContent,
	TooltipPortal,
	TooltipTrigger,
} from "../../ui/Tooltip";
import { Avatar } from "./Avatar";
import { Badge } from "./Badge";
import { DisplayableName, displayableNameFn } from "./DisplayableName";
import { SelfStatusEditor } from "./SelfStatusEditor";

/**
 * Overrides for rendering {@link ProfilePopoverContents} as a self-contained
 * preview — e.g. first-login onboarding, which sits outside the community and
 * user-preferences providers and whose avatar/banner may be local, not-yet-
 * uploaded files. When present, the community-dependent role colors/chips and
 * the external-client links are suppressed.
 */
export interface ProfilePreviewOverride {
	/** Avatar image URL, taking precedence over the actor's stored blob. */
	avatarUrl?: string;
	/** Banner image URL, taking precedence over the actor's stored blob. */
	bannerUrl?: string;
}

const MENTION_REGEX = /(?<!\S)@[a-zA-Z0-9._-]+(?:\.[a-zA-Z]{2,})?/gm;

/**
 * Takes in some text and automatically detects links and user mentions, then inserts anchor tags.
 * @param text The text to scan for links and mentions. Will be sanitized before any edits are made.
 * @returns An HTML string that can be used in the DOM
 */
const detectLinksAndMentionsAndFormat = (
	text: string,
	preferredBlueskyClient: BlueskyClientID,
) => {
	let modifiedText = `${purify(text)}`;
	let match: RegExpExecArray | null;

	let additionalOffset = 0;

	while ((match = LINK_REGEX.exec(text))) {
		const index = match.index;
		const link = match[0];

		const linkWithProtocol = link.startsWith("http") ? link : `https://${link}`;
		const anchorTag = `<a href="${linkWithProtocol}" rel="noreferrer" target="_blank">${link}</a>`;

		modifiedText =
			modifiedText.slice(0, index + additionalOffset) +
			anchorTag +
			modifiedText.slice(
				index + additionalOffset + link.length,
				modifiedText.length,
			);

		additionalOffset += anchorTag.length - link.length;
	}

	// Reset for second pass
	text = modifiedText;
	additionalOffset = 0;

	while ((match = MENTION_REGEX.exec(text))) {
		const index = match.index;
		const mention = match[0];

		const anchorTag = `<a href="${buildBskyProfileUrl(preferredBlueskyClient, mention.slice(1))}" target="_blank" rel="noreferrer">${mention}</a>`;

		modifiedText =
			modifiedText.slice(0, index + additionalOffset) +
			anchorTag +
			modifiedText.slice(
				index + additionalOffset + mention.length,
				modifiedText.length,
			);

		additionalOffset += anchorTag.length - mention.length;
	}

	return modifiedText.replaceAll("\n", "<br>");
};

export const ProfilePopoverContents: Component<{
	user: ActorData;
	preview?: ProfilePreviewOverride;
	class?: string;
	actions?: JSX.Element;
	onEditStatus?: () => void;
	hideDescription?: boolean;
	onRequestClose?: () => void;
}> = (props) => {
	const isPreview = () => props.preview !== undefined;

	const community = props.preview ? undefined : useCommunityContext();
	const userPreferences = props.preview ? undefined : useUserPreferences();
	const viewer = props.preview ? undefined : useUserContext();
	const settingsModal = props.preview ? undefined : useSettingsModalContext();
	const userRoles = () =>
		community ? community().utils.getRolesForUser(props.user.did) : [];
	const isSelf = () => !isPreview() && viewer?.did === props.user.did;

	const [bskyTooltipVisible, setBskyTooltipVisible] = createSignal(false);
	const [atProtoAtTooltipVisible, setAtProtoAtTooltipVisible] =
		createSignal(false);

	const bskyProfileHref = () =>
		`https://${
			getBskyAlternativeClientInfo(
				userPreferences!.preferences().preferredBlueskyClient,
			).base
		}/profile/${props.user.handle.replaceAll("at://", "")}`;

	const atProtoAtHref = () =>
		`https://atproto.at/uri/at://${props.user.handle.replaceAll("at://", "")}`;

	const accentColor = () =>
		readableUserColor(props.user.data.theme?.accentColor, resolvedTheme());

	const { all: allBadges } = useUserBadges(() => props.user);

	const bannerUrl = () =>
		props.preview?.bannerUrl ??
		resolveBlob(props.user.did, props.user.data.banner);

	return (
		<div
			class={cx("w-80 relative bg-card", props.class)}
			onContextMenu={(e) => e.stopPropagation()}
		>
			<div
				class="w-full aspect-3/1 bg-muted"
				style={(() => {
					const theme = props.user.data.theme;
					if (theme?.gradient?.primary && theme.gradient.secondary)
						return {
							background: `linear-gradient(135deg, ${theme.gradient.primary}, ${theme.gradient.secondary})`,
						};
					if (theme?.bannerColor) return { background: theme.bannerColor };
					return undefined;
				})()}
			>
				<Show when={bannerUrl()}>
					<img
						src={bannerUrl()}
						alt={`${props.user.data.displayName}'s Banner`}
						class="w-full h-full object-cover"
					/>
				</Show>
			</div>
			<div class="z-10 relative -mt-14 p-4 flex flex-col gap-2 pb-[calc(1rem+var(--safe-area-bottom))]">
				<div class="flex flex-row items-center gap-4 z-50">
					<Avatar
						user={props.user}
						size="large"
						overrideSrc={props.preview?.avatarUrl}
						disableState={isPreview()}
					/>
					<Show
						when={props.onEditStatus}
						fallback={
							<Show
								when={
									((props.user.data.status?.text?.length ?? 0) > 0 ||
										(props.user.data.status?.emoji?.length ?? 0) > 0) &&
									props.user.data?.onlineState !== "offline"
								}
							>
								<span class="flex flex-row items-start gap-2 bg-card border border-border rounded-sm px-1.5 py-0.5 drop-shadow-black drop-shadow-sm max-w-48 overflow-hidden">
									<Show when={props.user.data.status!.emoji}>
										<span
											class="h-5.5 w-5.5 [&>img]:min-w-4.5 [&>img]:min-h-4.5 [&>img]:w-4.5 [&>img]:h-4.5 [&>img]inline flex items-center justify-center"
											innerHTML={parseEmojiText(props.user.data.status!.emoji!)}
										/>
									</Show>
									<span
										class="leading-5.5 wrap-break-word text-sm w-fit"
										classList={{
											"max-w-[calc(100%-22px)]":
												!!props.user.data.status!.emoji,
											"max-w-full": !props.user.data.status!.emoji,
											hidden: props.user.data.status!.text.length === 0,
										}}
									>
										{props.user.data.status!.text}
									</span>
								</span>
							</Show>
						}
					>
						<SelfStatusEditor onEditRequested={props.onEditStatus!} />
					</Show>
				</div>
				<div class="px-1 flex flex-col">
					<span class="font-black text-xl">
						<Show
							when={!isPreview()}
							fallback={
								<span
									style={accentColor() ? { color: accentColor() } : undefined}
								>
									{displayableNameFn(props.user)}
								</span>
							}
						>
							<DisplayableName
								user={props.user}
								color={accentColor()}
								badge={false}
							/>
						</Show>
					</span>
					<div class="flex flex-row gap-2 items-center flex-wrap">
						<span class="text-sm">
							@{props.user.handle.replaceAll("at://", "")}
						</span>
						<Show when={!isPreview()}>
							<span class="w-1 h-1 rounded-full bg-muted-foreground" />
							<div class="flex flex-row gap-2 items-center">
								<Tooltip open={bskyTooltipVisible()}>
									<TooltipTrigger>
										<a
											href={bskyProfileHref()}
											target="_blank"
											rel="noreferrer"
											onClick={(e) => openExternalLink(bskyProfileHref(), e)}
											style={{
												"--hover": getBskyAlternativeClientInfo(
													userPreferences!.preferences().preferredBlueskyClient,
												).color,
											}}
											class="hover:text-(--hover) flex flex-row items-center gap-1.5 text-sm text-card-foreground font-normal hover:underline"
											onMouseEnter={() => setBskyTooltipVisible(true)}
											onMouseLeave={() => setBskyTooltipVisible(false)}
										>
											<Dynamic
												component={
													getBskyAlternativeClientInfo(
														userPreferences!.preferences()
															.preferredBlueskyClient,
													).icon
												}
												className=""
											/>
										</a>
									</TooltipTrigger>
									<TooltipPortal>
										<TooltipContent>
											<span>
												View on{" "}
												{
													getBskyAlternativeClientInfo(
														userPreferences!.preferences()
															.preferredBlueskyClient,
													).name
												}
											</span>
										</TooltipContent>
									</TooltipPortal>
								</Tooltip>
								<Tooltip open={atProtoAtTooltipVisible()}>
									<TooltipTrigger>
										<a
											href={atProtoAtHref()}
											target="_blank"
											rel="noreferrer"
											onClick={(e) => openExternalLink(atProtoAtHref(), e)}
											class="hover:text-[#1185fe] flex flex-row items-center gap-1.5 text-sm text-card-foreground font-normal hover:underline"
											onMouseEnter={() => setAtProtoAtTooltipVisible(true)}
											onMouseLeave={() => setAtProtoAtTooltipVisible(false)}
										>
											at://
										</a>
									</TooltipTrigger>
									<TooltipPortal>
										<TooltipContent>
											<span>
												View on atproto.
												<span class="test-[#1185fe]">at://</span>
											</span>
										</TooltipContent>
									</TooltipPortal>
								</Tooltip>
							</div>
						</Show>
						<Show when={allBadges().length > 0}>
							<span class="w-1 h-1 rounded-full bg-muted-foreground" />
							<For each={allBadges()}>
								{(val) => <Badge val={val} size="xs" />}
							</For>
						</Show>
					</div>
				</div>
				<Show when={props.user.data.description && !props.hideDescription}>
					<hr class="w-full h-px border-none bg-border m-0" />
					<p
						class="prose dark:prose-invert text-sm m-0 px-1 wrap-anywhere"
						onClick={handleExternalLinkClick}
						innerHTML={detectLinksAndMentionsAndFormat(
							props.user.data.description!,
							userPreferences?.preferences().preferredBlueskyClient ??
								"bluesky",
						)}
					/>
				</Show>
				<Show when={userRoles().length > 0}>
					<hr class="w-full h-px border-none bg-border m-0" />
					<div class="w-full flex flex-row items-center gap-1 flex-wrap">
						<For each={userRoles()}>
							{(role) => (
								<div class="flex flex-row items-center gap-2 border border-border rounded-full w-fit px-2">
									<div
										class="w-2 h-2 rounded-full"
										style={{ background: role.color ?? "#fff" }}
									/>
									<span class="text-sm">{role.name}</span>
								</div>
							)}
						</For>
					</div>
				</Show>
				<Show when={(isSelf() || props.actions) && !props.hideDescription}>
					<hr class="w-full h-px border-none bg-border m-0" />
					<div class="flex flex-col gap-1">
						<Show when={isSelf()}>
							<button
								type="button"
								class="w-full flex flex-row items-center gap-3 px-2 py-2 rounded-sm hover:bg-muted/50 cursor-pointer text-left text-sm"
								onClick={() => {
									props.onRequestClose?.();
									settingsModal?.setOpen(true);
								}}
							>
								<PencilSimpleIcon />
								<span>Edit Profile</span>
							</button>
						</Show>
						{props.actions}
					</div>
				</Show>
			</div>
		</div>
	);
};

export const ProfilePopover: ParentComponent<{
	user: ActorData;
	class?: string;
	disabled?: boolean;
	as?: "div" | "span";
	placement?: PopoverProps["placement"];
	actions?: (close: () => void) => JSX.Element;
	onEditStatus?: () => void;
}> = (props) => {
	const isMobile = useIsMobile();
	const [open, setOpen] = createSignal(false);
	const close = () => setOpen(false);

	return (
		<Show
			when={isMobile()}
			fallback={
				<Popover
					preventScroll
					placement={props.placement ?? "left"}
					flip
					open={open()}
					onOpenChange={setOpen}
				>
					<PopoverTrigger
						as={props.as ?? "div"}
						class={props.class}
						classList={{
							"pointer-events-none": props.disabled,
						}}
					>
						{props.children}
					</PopoverTrigger>
					<PopoverPortal>
						<PopoverContent class="w-80 p-0 overflow-hidden relative drop-shadow-black drop-shadow-xl">
							<ProfilePopoverContents
								user={props.user}
								actions={props.actions?.(close)}
								onEditStatus={props.onEditStatus}
								onRequestClose={close}
							/>
						</PopoverContent>
					</PopoverPortal>
				</Popover>
			}
		>
			<Dynamic
				component={props.as ?? "div"}
				class={props.class}
				classList={{ "pointer-events-none": props.disabled }}
				onClick={() => {
					if (!props.disabled) setOpen(true);
				}}
			>
				{props.children}
			</Dynamic>
			<BottomSheet
				open={open()}
				onOpenChange={setOpen}
				handleOverlay
				class="overflow-hidden"
			>
				<div class="min-h-0 overflow-y-auto">
					<ProfilePopoverContents
						class="w-full"
						user={props.user}
						actions={props.actions?.(close)}
						onEditStatus={props.onEditStatus}
						onRequestClose={close}
					/>
				</div>
			</BottomSheet>
		</Show>
	);
};
