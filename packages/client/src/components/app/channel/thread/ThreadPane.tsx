import { useLocation, useSearchParams } from "@solidjs/router";
import {
	type Component,
	createEffect,
	createMemo,
	on,
	onCleanup,
	Show,
} from "solid-js";
import { parseThreadPath } from "../../../../atproto/colibri-channel-url";
import { isVisibleAnchor, type ThreadView } from "../../../../atproto/views";
import {
	ChannelContext,
	ChannelContextProvider,
	usePrimaryChannelContext,
} from "../../../../contexts/Channel";
import { useThreads } from "../../../../contexts/Threads";
import { ChannelSurface } from "../../../../layouts/ChannelLayout";
import { createMobilePane, useIsMobile } from "../../../../utils/mobile-pane";
import { presentationFromSearch } from "../../../../utils/thread-presentation";
import { Message } from "../message/Message";
import { MessagePreview } from "../message/MessagePreview";
import { ThreadHeader } from "./ThreadHeader";
import { ThreadPaneResizer } from "./ThreadPaneResizer";
import { threadAsChannelView } from "./thread-channel-view";

const ThreadAnchor: Component<{ thread: ThreadView }> = (props) => {
	const primary = usePrimaryChannelContext();

	const indexed = () => {
		const anchor = props.thread.anchorMessage;
		return anchor !== undefined && isVisibleAnchor(anchor) ? anchor : undefined;
	};

	const loaded = () => {
		const anchor = props.thread.anchor;
		const parent = primary();
		if (anchor === undefined || parent === undefined) return undefined;
		return parent
			.messages()
			.find(
				(entry) =>
					!("hash" in entry) &&
					entry.rkey === anchor.rkey &&
					entry.author.did === anchor.did &&
					entry.channel === anchor.space,
			);
	};

	const message = () => indexed() ?? loaded();

	return (
		<Show when={message()}>
			{(anchor) => (
				<div class="w-full">
					<Show
						when={primary()}
						fallback={
							<div class="px-3 py-2">
								<MessagePreview data={anchor()} textClass="line-clamp-3" />
							</div>
						}
					>
						{(parent) => (
							<ChannelContext.Provider value={parent()}>
								<Message
									anchor
									data={anchor()}
									isSubsequent={false}
									hasSubsequent={false}
									isLast
								/>
							</ChannelContext.Provider>
						)}
					</Show>
				</div>
			)}
		</Show>
	);
};

export const ThreadPane: Component = () => {
	const location = useLocation();
	const [searchParams] = useSearchParams();
	const threads = useThreads();
	const isMobile = useIsMobile();
	const { paneTranslate, isDragging } = createMobilePane();

	const space = createMemo(
		() => parseThreadPath(location.pathname)?.threadSpace,
	);

	const thread = createMemo(() => {
		const uri = space();
		return uri === undefined ? undefined : threads.bySpace(uri);
	});

	const presentation = () =>
		presentationFromSearch(searchParams.split, isMobile());

	createEffect(
		on(space, (uri) => {
			threads.setOpenThreadSpace(uri);
			if (uri === undefined) return;
			threads.closeDraft();
			threads.markRead(uri);
			void threads.fetchThread(uri);
		}),
	);

	onCleanup(() => threads.setOpenThreadSpace(undefined));

	const channel = createMemo(() => {
		const current = thread();
		return current === undefined ? undefined : threadAsChannelView(current);
	});

	return (
		<Show when={space()}>
			<div
				class="flex flex-col bg-background"
				style={{ transform: paneTranslate("thread") }}
				classList={{
					"absolute inset-0 w-full z-25 will-change-pane": isMobile(),
					"transition-transform duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] motion-reduce:transition-none":
						isMobile() && !isDragging(),
					"relative h-full w-[var(--thread-width)] min-w-[var(--thread-width)] shrink-0 border-l border-border":
						!isMobile() && presentation() === "split",
					"absolute inset-y-0 right-[var(--members-width)] left-[var(--channel-sidebar-width)] z-20":
						!isMobile() && presentation() === "full",
				}}
			>
				<Show
					when={thread()}
					fallback={
						<div class="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
							Loading thread...
						</div>
					}
				>
					{(current) => (
						<ChannelContextProvider channel={channel} surface="thread">
							<ChannelSurface
								header={
									<ThreadHeader
										thread={current()}
										presentation={presentation()}
										isMobile={isMobile()}
									/>
								}
								intro={<ThreadAnchor thread={current()} />}
							/>
						</ChannelContextProvider>
					)}
				</Show>
				<Show when={!isMobile() && presentation() === "split"}>
					<ThreadPaneResizer />
				</Show>
			</div>
		</Show>
	);
};
