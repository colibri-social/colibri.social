import type { ActorData } from "@colibri-social/lib";
import twemoji from "@twemoji/api";
import {
	type Component,
	createSignal,
	For,
	type ParentComponent,
	Show,
} from "solid-js";
import { resolveBlob } from "../../../atproto/resolve-blob";
import { LINK_REGEX } from "../../../utils/link-regex";
import { purify } from "../../..//utils/purify";
import {
	Popover,
	PopoverContent,
	PopoverPortal,
	PopoverTrigger,
} from "../../ui/Popover";
import { BottomSheet } from "../../ui/MenuDrawer";
import { useIsMobile } from "../../../utils/mobile-pane";
import {
	Tooltip,
	TooltipContent,
	TooltipPortal,
	TooltipTrigger,
} from "../../ui/Tooltip";
import { Avatar } from "./Avatar";
import { DisplayableName, displayableNameFn } from "./DisplayableName";
import { useCommunityContext } from "../../../contexts/Community";
import { useUserPreferences } from "../../../contexts/UserPreferences";
import { getBskyAlternativeClientInfo } from "../../../atproto/bluesky-alternatives";
import { Dynamic } from "solid-js/web";
import { cx } from "../../../utils/cva";

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
const detectLinksAndMentionsAndFormat = (text: string) => {
	let modifiedText = `${purify(text)}`;
	let match: RegExpExecArray | null;

	let additionalOffset = 0;

	while ((match = LINK_REGEX.exec(text))) {
		const index = match.index;
		const link = match[0];

		const linkWithProtocol = link.startsWith("http") ? link : `https://${link}`;
		const anchorTag = `<a href="${linkWithProtocol}" target="_blank" rel="noreferrer">${link}</a>`;

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

		const anchorTag = `<a href="https://bsky.app/profile/${mention.slice(1)}" target="_blank" rel="noreferrer">${mention}</a>`;

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
	/** Render as a static preview (see {@link ProfilePreviewOverride}). */
	preview?: ProfilePreviewOverride;
	/** Extra classes for the root, merged over the default `w-80`. */
	class?: string;
}> = (props) => {
	const isPreview = () => props.preview !== undefined;

	// Both providers throw when absent, so only read them outside preview mode
	// (onboarding renders this before any community/preferences provider exists).
	const community = props.preview ? undefined : useCommunityContext();
	const userPreferences = props.preview ? undefined : useUserPreferences();
	const userRoles = () =>
		community ? community().utils.getRolesForUser(props.user.did) : [];

	const [bskyTooltipVisible, setBskyTooltipVisible] = createSignal(false);
	const [atProtoAtTooltipVisible, setAtProtoAtTooltipVisible] =
		createSignal(false);

	const accentColor = () => props.user.data.theme?.accentColor;

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
			<div class="z-10 relative -mt-14 p-4 flex flex-col gap-2">
				<div class="flex flex-row items-center gap-4 z-50">
					<Avatar
						user={props.user}
						size="large"
						overrideSrc={props.preview?.avatarUrl}
						disableState={isPreview()}
					/>
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
									innerHTML={twemoji.parse(props.user.data.status!.emoji!)}
								/>
							</Show>
							<span
								class="leading-5.5 wrap-break-word text-sm w-fit"
								classList={{
									"max-w-[calc(100%-22px)]": !!props.user.data.status!.emoji,
									"max-w-full": !props.user.data.status!.emoji,
								}}
							>
								{props.user.data.status!.text}
							</span>
						</span>
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
							<DisplayableName user={props.user} color={accentColor()} />
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
											href={`https://${
												getBskyAlternativeClientInfo(
													userPreferences!.preferences().preferredBlueskyClient,
												).base
											}/profile/${props.user.handle.replaceAll("at://", "")}`}
											target="_blank"
											rel="noreferrer"
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
											href={`https://atproto.at/uri/${props.user.handle}`}
											target="_blank"
											rel="noreferrer"
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
					</div>
				</div>
				<Show when={props.user.data.description}>
					<hr class="w-full h-px border-none bg-border m-0" />
					<p
						class="prose dark:prose-invert text-sm m-0 px-1"
						innerHTML={purify(
							detectLinksAndMentionsAndFormat(props.user.data.description!),
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
			</div>
		</div>
	);
};

export const ProfilePopover: ParentComponent<{
	user: ActorData;
	class?: string;
	disabled?: boolean;
	/** Render the trigger as this element. Use "span" when the popover is
	 *  placed inside inline text (e.g. a mention inside a <p>) so that the
	 *  DOM stays valid — block-level <div> triggers inside <p> cause browsers
	 *  to split the paragraph and break Kobalte's trigger detection. */
	as?: "div" | "span";
}> = (props) => {
	const isMobile = useIsMobile();
	const [open, setOpen] = createSignal(false);

	return (
		<Show
			when={isMobile()}
			fallback={
				<Popover preventScroll placement="left" flip>
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
							<ProfilePopoverContents user={props.user} />
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
					<ProfilePopoverContents class="w-full" user={props.user} />
				</div>
			</BottomSheet>
		</Show>
	);
};
