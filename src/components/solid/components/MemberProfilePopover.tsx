import twemoji from "@twemoji/api";
import { createSignal, type ParentComponent, Show } from "solid-js";
import { purify } from "@/utils/purify";
import { useGlobalContext } from "../contexts/GlobalContext";
import { Bluesky } from "../icons/Bluesky";
import { PDSls } from "../icons/PDSls";
import {
	Popover,
	PopoverContent,
	PopoverPortal,
	PopoverTrigger,
} from "../shadcn-solid/Popover";
import {
	Tooltip,
	TooltipContent,
	TooltipPortal,
	TooltipTrigger,
} from "../shadcn-solid/Tooltip";

export const LINK_REGEX =
	/(?<![^\s])(?!@)(https?:\/\/(www\.)?)?[-a-zA-Z0-9@%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,18}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/gm;

const MENTION_REGEX = /(?<!\S)@[a-zA-Z0-9._-]+(?:\.[a-zA-Z]{2,})?/gm;

const detectLinksAndMentionsAndFormat = (text: string) => {
	let modifiedText = `${text}`;
	let match: RegExpExecArray | null;

	let additionalOffset = 0;

	while ((match = LINK_REGEX.exec(text))) {
		const index = match.index;
		const link = match[0];

		const linkWithProtocol = link.startsWith("http") ? link : `https://${link}`;
		const anchorTag = `<a href="${linkWithProtocol}" target="_blank">${link}</a>`;

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

		const anchorTag = `<a href="https://bsky.app/profile/${mention.slice(1)}" target="_blank">${mention}</a>`;

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

export const MemberProfilePopover: ParentComponent<{
	banner?: string;
	avatar: string;
	displayName: string;
	handle?: string;
	description?: string;
	status?: string;
	emoji?: string;
	class?: string;
	did: string;
	disabled?: boolean;
}> = (props) => {
	const [globalData] = useGlobalContext();
	const [bskyTooltipVisible, setBskyTooltipVisible] = createSignal(false);
	const [pdslsTooltipVisible, setPdslsTooltipVisible] = createSignal(false);

	const state = () =>
		globalData.userOnlineStates.find((x) => x.did === props.did)?.state ||
		"offline";

	return (
		<Popover preventScroll placement="left" flip>
			<PopoverTrigger
				as="div"
				class={props.class}
				classList={{
					"pointer-events-none": props.disabled,
				}}
			>
				{props.children}
			</PopoverTrigger>
			<PopoverPortal>
				<PopoverContent class="w-80 p-0 overflow-hidden relative drop-shadow-black drop-shadow-xl">
					<div class="w-full aspect-3/1 bg-muted absolute z-0">
						<Show when={props.banner}>
							<img
								src={props.banner}
								alt={`${props.displayName}'s Banner`}
								class="w-full h-full"
							/>
						</Show>
					</div>
					<div class="mt-12 z-10 relative p-4 flex flex-col gap-2">
						<div class="flex flex-row items-center gap-4">
							<div class="w-20 h-20 relative">
								<img
									src={props.avatar || "/user-placeholder.png"}
									alt={`${props.displayName}'s Avatar`}
									class="w-20 h-20 rounded-full outline-4 outline-card"
								/>
								<div
									class="w-4 h-4 rounded-full absolute bottom-0.75 right-0.75 outline-4 outline-card"
									classList={{
										"bg-green-500": state() === "online",
										"bg-yellow-500": state() === "away",
										"bg-red-500": state() === "dnd",
										"bg-neutral-500": state() === "offline",
									}}
								/>
							</div>
							<Show when={props.status && state() !== "offline"}>
								<span class="flex flex-row items-start gap-2 bg-card border border-border rounded-sm px-1.5 py-0.5 drop-shadow-black drop-shadow-sm max-w-48 overflow-hidden">
									<Show when={props.emoji}>
										<span
											class="h-5.5 w-5.5 [&>img]:min-w-4.5 [&>img]:min-h-4.5 [&>img]:w-4.5 [&>img]:h-4.5 [&>img]inline flex items-center justify-center"
											innerHTML={twemoji.parse(props.emoji!)}
										/>
									</Show>
									<span
										class="leading-5.5 wrap-break-word text-sm w-fit"
										classList={{
											"max-w-[calc(100%-22px)]": !!props.emoji,
											"max-w-full": !props.emoji,
										}}
									>
										{props.status}
									</span>
								</span>
							</Show>
						</div>
						<div class="px-1 flex flex-col">
							<span class="font-black text-xl">{props.displayName}</span>
							<div class="flex flex-row gap-2 items-center flex-wrap">
								<span class="text-sm">@{props.handle}</span>
								<span class="w-1 h-1 rounded-full bg-muted-foreground" />
								<div class="flex flex-row gap-2 items-center">
									<Tooltip open={bskyTooltipVisible()}>
										<TooltipTrigger>
											<a
												href={`https://bsky.app/profile/${props.handle}`}
												target="_blank"
												class="hover:text-[#1185FE] flex flex-row items-center gap-1.5 text-sm text-card-foreground font-normal hover:underline"
												onMouseEnter={() => setBskyTooltipVisible(true)}
												onMouseLeave={() => setBskyTooltipVisible(false)}
											>
												<Bluesky />
											</a>
										</TooltipTrigger>
										<TooltipPortal>
											<TooltipContent>
												<span>View on Bluesky</span>
											</TooltipContent>
										</TooltipPortal>
									</Tooltip>
									<Tooltip open={pdslsTooltipVisible()}>
										<TooltipTrigger>
											<a
												href={`https://pdsls.dev/at://${props.handle}`}
												target="_blank"
												class="hover:text-[#76c4e5] flex flex-row items-center gap-1.5 text-sm text-card-foreground font-normal hover:underline"
												onMouseEnter={() => setPdslsTooltipVisible(true)}
												onMouseLeave={() => setPdslsTooltipVisible(false)}
											>
												<PDSls size={16} />
											</a>
										</TooltipTrigger>
										<TooltipPortal>
											<TooltipContent>
												<span>View on PDSls</span>
											</TooltipContent>
										</TooltipPortal>
									</Tooltip>
								</div>
							</div>
						</div>
						<Show when={props.description}>
							<hr class="w-full h-px border-none bg-border m-0" />
							<p
								class="prose prose-invert text-sm m-0 px-1"
								innerHTML={purify(
									detectLinksAndMentionsAndFormat(props.description!),
								)}
							/>
						</Show>
					</div>
				</PopoverContent>
			</PopoverPortal>
		</Popover>
	);
};
