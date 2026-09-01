import {
	type Component,
	createEffect,
	createMemo,
	createSignal,
	on,
	Show,
} from "solid-js";
import { toast } from "somoto";
import ArrowsMergeIcon from "~icons/ph/arrows-merge";
import CaretLeftIcon from "~icons/ph/caret-left";
import XIcon from "~icons/ph/x";
import { enqueueMessageSend } from "../../../../atproto/outbox/sends";
import type { Facet } from "../../../../atproto/views";
import { ChannelContextProvider } from "../../../../contexts/Channel";
import { useCommunityContext } from "../../../../contexts/Community";
import { useThreads } from "../../../../contexts/Threads";
import { useUserContext } from "../../../../contexts/User";
import { createHistoryBackClose } from "../../../../hooks/createHistoryBackClose";
import {
	describeFileError,
	MAX_ATTACHMENTS,
} from "../../../../layouts/ChannelLayout";
import { useIsMobile } from "../../../../utils/mobile-pane";
import { useThreadNavigation } from "../../../../utils/thread-navigation";
import { FileField, FileFieldHiddenInput } from "../../../ui/FileField";
import {
	TextField,
	TextFieldInput,
	TextFieldLabel,
} from "../../../ui/TextField";
import {
	type ComposerSubmission,
	MessageInput,
} from "../../community/MessageInput";
import { MessagePreview } from "../message/MessagePreview";
import { ThreadPaneResizer } from "./ThreadPaneResizer";
import { FALLBACK_THREAD_NAME } from "./thread-name";

export const ThreadDraftPane: Component = () => {
	const threads = useThreads();
	const community = useCommunityContext();
	const user = useUserContext();
	const isMobile = useIsMobile();
	const { open } = useThreadNavigation();

	const [name, setName] = createSignal("");
	const [busy, setBusy] = createSignal(false);

	const draft = () => threads.draft();

	createHistoryBackClose(
		() => isMobile() && draft() !== undefined,
		() => threads.closeDraft(),
	);

	createEffect(
		on(draft, () => {
			setName("");
			setBusy(false);
		}),
	);

	const parent = createMemo(() => {
		const current = draft();
		if (!current) return undefined;
		return community().channels.find(
			(channel) => channel.space === current.channel,
		);
	});

	const canPost = () => parent()?.viewer.canPost ?? false;

	const chosenName = (): string => {
		const current = draft();
		const typed = name().trim();
		if (typed) return typed;
		return current?.suggestedName || FALLBACK_THREAD_NAME;
	};

	const submit = async (submission: ComposerSubmission): Promise<boolean> => {
		const current = draft();
		if (!current || busy()) return false;

		setBusy(true);
		try {
			const created = await threads.createThread({
				channel: current.channel,
				name: chosenName(),
				...(current.anchor ? { anchor: current.anchor } : {}),
			});
			if (!created) return false;

			const queued = await enqueueMessageSend({
				space: created.space,
				repo: user.did,
				text: submission.text,
				facets: submission.facets as unknown as Array<Facet>,
				files: submission.files,
				suppressedEmbeds: submission.suppressedEmbeds,
			});

			open(created, "split");
			threads.closeDraft();

			if (!queued.ok) {
				toast.error("Too much waiting to upload", {
					description:
						"Send or remove some of your queued attachments before adding more.",
				});
				return false;
			}

			return true;
		} finally {
			setBusy(false);
		}
	};

	return (
		<Show when={draft()}>
			{(current) => (
				<div
					class="flex flex-col bg-background"
					classList={{
						"fixed inset-0 z-30": isMobile(),
						"relative h-full w-[var(--thread-width)] min-w-[var(--thread-width)] shrink-0 border-l border-border":
							!isMobile(),
					}}
				>
					<div class="flex w-full shrink-0 flex-col border-b border-border h-12">
						<div class="flex h-12 w-full flex-row items-center gap-2 p-2 pl-1">
							<button
								type="button"
								onClick={() => threads.closeDraft()}
								class="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md hover:bg-muted/50"
								aria-label="Discard thread"
							>
								<Show
									when={isMobile()}
									fallback={<XIcon width={18} height={18} />}
								>
									<CaretLeftIcon width={20} height={20} />
								</Show>
							</button>
							<ArrowsMergeIcon
								class="shrink-0 rotate-180 text-muted-foreground"
								width={18}
								height={18}
							/>
							<div class="flex min-w-0 flex-col">
								<span class="min-w-0 truncate text-sm">New thread</span>
								<Show when={parent()}>
									{(channel) => (
										<span class="truncate text-xs text-muted-foreground">
											in {channel().name}
										</span>
									)}
								</Show>
							</div>
						</div>
					</div>
					<div class="flex shrink-0 flex-col gap-3 border-b border-border px-3 py-3">
						<TextField class="gap-1.5">
							<TextFieldLabel class="text-xs text-muted-foreground">
								Thread name (optional)
							</TextFieldLabel>
							<TextFieldInput
								value={name()}
								maxLength={128}
								placeholder={current().suggestedName || FALLBACK_THREAD_NAME}
								onInput={(event) => setName(event.currentTarget.value)}
							/>
						</TextField>
						<Show when={current().anchorMessage}>
							{(message) => (
								<MessagePreview data={message()} textClass="line-clamp-3" />
							)}
						</Show>
					</div>
					<ChannelContextProvider channel={parent} surface="draft">
						<FileField
							class="gap-0! flex w-full flex-col justify-end"
							multiple
							maxFiles={MAX_ATTACHMENTS}
							onFileReject={(rejections) => {
								const messages = [
									...new Set(
										rejections.flatMap((rejection) =>
											rejection.errors.map((error) =>
												describeFileError(error, rejection.file.name),
											),
										),
									),
								];
								toast.error(
									rejections.length === 1
										? "Couldn't add file"
										: "Couldn't add files",
									{ description: messages.join("\n") },
								);
							}}
						>
							<MessageInput
								disabled={!canPost()}
								disabledReason="You are not allowed to send messages in this channel."
								channelName={parent()?.name ?? ""}
								placeholder="Enter a message to start the conversation!"
								maxAttachments={MAX_ATTACHMENTS}
								onSend={submit}
							/>
							<FileFieldHiddenInput />
						</FileField>
					</ChannelContextProvider>
					<Show when={!isMobile()}>
						<ThreadPaneResizer />
					</Show>
				</div>
			)}
		</Show>
	);
};
