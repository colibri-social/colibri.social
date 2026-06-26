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
import {
	Tooltip,
	TooltipContent,
	TooltipPortal,
	TooltipTrigger,
} from "../../ui/Tooltip";
import User from ".";
import { DisplayableName } from "./DisplayableName";
import { useCommunityContext } from "../../../contexts/Community";
import { useUserPreferences } from "../../../contexts/UserPreferences";
import { getBskyAlternativeClientInfo } from "../../../atproto/bluesky-alternatives";
import { Dynamic } from "solid-js/web";

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

export const ProfilePopoverContents: Component<{ user: ActorData }> = (
	props,
) => {
	const community = useCommunityContext();
	const userPreferences = useUserPreferences();
	const userRoles = () => community().utils.getRolesForUser(props.user.did);

	const [bskyTooltipVisible, setBskyTooltipVisible] = createSignal(false);
	const [atProtoAtTooltipVisible, setAtProtoAtTooltipVisible] =
		createSignal(false);

	return (
		<div
			class="w-80 relative pt-12 bg-card"
			onContextMenu={(e) => e.stopPropagation()}
		>
			<div class="w-full aspect-3/1 bg-muted absolute z-0 top-0">
				<Show when={props.user.data.banner}>
					<img
						src={resolveBlob(props.user.did, props.user.data.banner)}
						alt={`${props.user.data.displayName}'s Banner`}
						class="w-full h-full"
					/>
				</Show>
			</div>
			<div class="z-10 relative p-4 flex flex-col gap-2">
				<div class="flex flex-row items-center gap-4">
					<User.Avatar user={props.user} size="large" />
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
						<DisplayableName user={props.user} />
					</span>
					<div class="flex flex-row gap-2 items-center flex-wrap">
						<span class="text-sm">
							@{props.user.handle.replaceAll("at://", "")}
						</span>
						<span class="w-1 h-1 rounded-full bg-muted-foreground" />
						<div class="flex flex-row gap-2 items-center">
							<Tooltip open={bskyTooltipVisible()}>
								<TooltipTrigger>
									<a
										href={`https://${
											getBskyAlternativeClientInfo(
												userPreferences.preferences().preferredBlueskyClient,
											).base
										}/profile/${props.user.handle.replaceAll("at://", "")}`}
										target="_blank"
										rel="noreferrer"
										style={{
											"--hover": getBskyAlternativeClientInfo(
												userPreferences.preferences().preferredBlueskyClient,
											).color,
										}}
										class="hover:text-(--hover) flex flex-row items-center gap-1.5 text-sm text-card-foreground font-normal hover:underline"
										onMouseEnter={() => setBskyTooltipVisible(true)}
										onMouseLeave={() => setBskyTooltipVisible(false)}
									>
										<Dynamic
											component={
												getBskyAlternativeClientInfo(
													userPreferences.preferences().preferredBlueskyClient,
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
													userPreferences.preferences().preferredBlueskyClient,
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
	return (
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
	);
};
