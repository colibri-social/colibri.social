import { actions } from "astro:actions";
import {
	type Component,
	createSignal,
	Match,
	type ParentComponent,
	Show,
	Switch,
} from "solid-js";
import createMediaQuery from "@/utils/create-media-query";
import type { IndexedMessageData } from "@/utils/sdk";
import {
	type GlobalContextUtility,
	type PendingMessageData,
	useGlobalContext,
} from "../contexts/GlobalContext";
import { useMessageContext } from "../contexts/MessageContext";
import { Pencil } from "../icons/Pencil";
import { Reply } from "../icons/Reply";
import { Trash } from "../icons/Trash";
import { Button } from "../shadcn-solid/Button";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuPortal,
	ContextMenuTrigger,
} from "../shadcn-solid/ContextMenu";
import {
	Dialog,
	DialogCloseButton,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogPortal,
	DialogTitle,
	DialogTrigger,
} from "../shadcn-solid/Dialog";
import {
	Drawer,
	DrawerClose,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerLabel,
	DrawerPortal,
	DrawerTrigger,
} from "../shadcn-solid/Drawer";
import { MessageAction } from "./MessageAction";

const [messageToBeDeleted, setMessageToBeDeleted] =
	createSignal<IndexedMessageData>();
const [deletionModalOpen, setDeletionModalOpen] = createSignal(false);

const deleteMessageAndCloseModal = (
	addDeletedMessage: GlobalContextUtility["addDeletedMessage"],
) => {
	const message = messageToBeDeleted()!;

	actions.deleteMessage({
		rkey: message.rkey,
	});

	addDeletedMessage({
		author_did: message.author_did,
		channel: message.channel,
		rkey: message.rkey,
		type: "message_deleted",
	});

	setDeletionModalOpen(false);
};

const MessageDeletionDrawer: ParentComponent<{
	message: IndexedMessageData | PendingMessageData;
	addDeletedMessage: GlobalContextUtility["addDeletedMessage"];
}> = (props) => {
	const isPending = () => "hash" in props.message;
	const isDesktop = createMediaQuery("(min-width: 768px)");

	const MockMessage: Component = () => (
		<div
			class={`w-fullh-fit flex flex-row p-2 gap-4 group relative border border-border rounded-sm`}
			classList={{
				"mx-4": !isDesktop(),
				"w-full mx-0": isDesktop(),
			}}
		>
			<img
				src={props.message.avatar_url || "/logo.png"}
				alt={props.message.display_name}
				class="w-10 h-10 min-w-10 min-h-10 bg-muted rounded-full border border-border"
				loading="lazy"
			/>
			<div class="flex flex-col w-full justify-center">
				<div class="flex gap-2 text-sm items-baseline">
					<span class="font-bold">{props.message.display_name}</span>
					<small class="text-muted-foreground">
						{new Date(
							isPending()
								? (props.message as PendingMessageData).createdAt
								: (props.message as IndexedMessageData).created_at,
						).toLocaleDateString()}{" "}
						{new Date(
							isPending()
								? (props.message as PendingMessageData).createdAt
								: (props.message as IndexedMessageData).created_at,
						).toLocaleTimeString(undefined, {
							hour: "2-digit",
							minute: "2-digit",
						})}
					</small>
				</div>
				<p
					class="m-0"
					classList={{
						"text-muted-foreground": isPending(),
						"text-foreground": !isPending(),
					}}
				>
					{props.message.text}
				</p>
			</div>
		</div>
	);

	const MobileDrawer: Component = () => (
		<Drawer breakPoints={[0.75]} open={deletionModalOpen()}>
			<DrawerTrigger>{props.children}</DrawerTrigger>
			<DrawerPortal>
				<DrawerContent>
					<DrawerHeader>
						<DrawerLabel class="m-0">Delete this message?</DrawerLabel>
						<DrawerDescription class="m-0">
							This action cannot be undone.
						</DrawerDescription>
					</DrawerHeader>
					<MockMessage />
					<p class="text-sm text-muted-foreground my-1">
						Tip: You can shift-click the delete button to skip this pop-up!
					</p>
					<DrawerFooter>
						<Button
							variant="destructive"
							class="cursor-pointer"
							onClick={() => {
								deleteMessageAndCloseModal(props.addDeletedMessage);
								setMessageToBeDeleted(props.message as IndexedMessageData);
							}}
						>
							Delete message
						</Button>
						<DrawerClose class="w-full">
							<Button
								variant="secondary"
								class="w-full cursor-pointer"
								onClick={() => setDeletionModalOpen(false)}
							>
								Cancel
							</Button>
						</DrawerClose>
					</DrawerFooter>
				</DrawerContent>
			</DrawerPortal>
		</Drawer>
	);

	return (
		<Show when={isDesktop()} fallback={<MobileDrawer />}>
			<Dialog open={deletionModalOpen()}>
				<DialogTrigger class="w-full">{props.children}</DialogTrigger>
				<DialogPortal>
					<DialogContent>
						<DialogHeader>
							<DialogTitle class="m-0">Delete this message?</DialogTitle>
							<DialogDescription class="m-0">
								This action cannot be undone.
							</DialogDescription>
						</DialogHeader>
						<MockMessage />
						<p class="text-sm text-muted-foreground my-1">
							Tip: You can shift-click the delete button to skip this pop-up!
						</p>
						<DialogFooter>
							<Button
								variant="destructive"
								class="cursor-pointer"
								onClick={() => {
									deleteMessageAndCloseModal(props.addDeletedMessage);
									setMessageToBeDeleted(props.message as IndexedMessageData);
								}}
							>
								Delete message
							</Button>
							<DialogCloseButton>
								<Button
									variant="secondary"
									class="cursor-pointer"
									onClick={() => setDeletionModalOpen(false)}
								>
									Cancel
								</Button>
							</DialogCloseButton>
						</DialogFooter>
					</DialogContent>
				</DialogPortal>
			</Dialog>
		</Show>
	);
};

const MessageContextMenu: ParentComponent<{
	data: IndexedMessageData | PendingMessageData;
	disabled: boolean;
	enableEditMode: () => void;
	enableReplyMode: () => void;
	handlePotentialDeletion: (e: MouseEvent) => void;
	addDeletedMessage: GlobalContextUtility["addDeletedMessage"];
}> = (props) => {
	return (
		<ContextMenu>
			<ContextMenuTrigger disabled={props.disabled || deletionModalOpen()}>
				{props.children}
			</ContextMenuTrigger>
			<ContextMenuPortal>
				<ContextMenuContent class="w-32">
					<ContextMenuItem onClick={props.enableReplyMode}>
						<Reply />
						<span>Reply</span>
					</ContextMenuItem>
					<ContextMenuItem onClick={props.enableEditMode}>
						<Pencil />
						<span>Edit</span>
					</ContextMenuItem>
					<MessageDeletionDrawer
						message={props.data}
						addDeletedMessage={props.addDeletedMessage}
					>
						<ContextMenuItem
							class="text-destructive"
							onClick={(e) => {
								setMessageToBeDeleted(props.data as IndexedMessageData);
								props.handlePotentialDeletion(e);
							}}
						>
							<Trash />
							<span>Delete</span>
						</ContextMenuItem>
					</MessageDeletionDrawer>
				</ContextMenuContent>
			</ContextMenuPortal>
		</ContextMenu>
	);
};

export const Message: Component<{
	data: IndexedMessageData | PendingMessageData;
	isSubsequent: boolean;
}> = (props) => {
	const [messageData, { setReplyingTo, jumpToMessage }] = useMessageContext();
	const [globalData, { addDeletedMessage }] = useGlobalContext();
	const isPending = () => "hash" in props.data;

	const enableReplyMode = () => {
		if (isPending()) return;

		setReplyingTo(props.data as IndexedMessageData);
	};

	const enableEditMode = () => {
		// TODO:
		// 1. Show input
		// 2. On enter of said input, submit edit request and immediately hide input, replace text with edited one
		// 3. We don't care about a websocket response in this case, this can be handled locally
	};

	const handlePotentialDeletion = (e: MouseEvent) => {
		if (isPending()) return;

		if (e.shiftKey) {
			return deleteMessageAndCloseModal(addDeletedMessage);
		}

		setDeletionModalOpen(true);
	};

	const isRepliedTo = () => {
		if ("hash" in props.data) return;

		return (
			messageData.replyingTo?.author_did === globalData.user.sub &&
			messageData.replyingTo?.rkey === props.data.rkey
		);
	};

	const isSubsequentMessage = () => {
		if (!props.isSubsequent || typeof props.data.parent === "string") {
			return false;
		}

		return true;
	};

	const isFocused = () => {
		if ("hash" in props.data) return false;

		return (
			messageData.focusedMessage?.author_did === props.data.author_did &&
			messageData.focusedMessage.rkey === props.data.rkey
		);
	};

	return (
		<MessageContextMenu
			disabled={isPending()}
			enableEditMode={enableEditMode}
			handlePotentialDeletion={handlePotentialDeletion}
			data={props.data}
			addDeletedMessage={addDeletedMessage}
			enableReplyMode={enableReplyMode}
		>
			<div
				class={`w-full h-fit flex flex-col pr-4 pl-3.5 gap-2 group border-l-2 relative hover:bg-card/50 transition-colors duration-75`}
				data-message={JSON.stringify(props.data)}
				classList={{
					"py-0": isSubsequentMessage(),
					"pb-0 pt-1 mt-2": !isSubsequentMessage(),
					"border-transparent": !isRepliedTo(),
					"bg-primary/15 hover:bg-primary/25 border-primary": isRepliedTo(),
					"bg-primary/15": isFocused(),
				}}
			>
				<Show when={props.data.parent_message}>
					<div class="flex flex-row gap-4 group/reply cursor-pointer w-fit">
						<button
							type="button"
							class="before:w-8 before:block before:h-2 before:border-t before:border-l before:border-muted-foreground/50 before:rounded-tl-sm w-10 h-4 relative before:absolute before:left-1/2 before:transform before:-translate-x-1 group-hover/reply:before:border-foreground cursor-pointer"
							onClick={() => jumpToMessage(props.data.parent_message!)}
						/>
						<div
							class="flex flex-row items-center gap-2 group-hover/reply:text-foreground"
							onClick={() => jumpToMessage(props.data.parent_message!)}
						>
							<img
								src={props.data.parent_message!.avatar_url}
								width={16}
								height={16}
								alt={props.data.parent_message!.display_name}
								class="rounded-full"
							/>
							<strong class="text-xs">
								{props.data.parent_message!.display_name}
							</strong>
							<span class="text-xs">{props.data.parent_message!.text}</span>
						</div>
					</div>
				</Show>
				<div class="flex flex-row gap-4">
					<Switch>
						<Match when={!isSubsequentMessage()}>
							<img
								src={props.data.avatar_url || "/logo.png"}
								alt={props.data.display_name}
								class="w-10 h-10 min-w-10 min-h-10 bg-muted rounded-full border border-border"
								loading="lazy"
							/>
						</Match>
						<Match when={isSubsequentMessage()}>
							<div class="w-10 h-8 min-w-10 min-h-8 text-muted-foreground group-hover:opacity-100 opacity-0 text-xs flex items-center justify-center">
								<span>
									{new Date(
										isPending()
											? (props.data as PendingMessageData).createdAt
											: (props.data as IndexedMessageData).created_at,
									).toLocaleTimeString(undefined, {
										hour: "2-digit",
										minute: "2-digit",
									})}
								</span>
							</div>
						</Match>
					</Switch>
					<div class="flex flex-col w-full justify-center">
						<Show when={!isSubsequentMessage()}>
							<div class="flex gap-2 text-sm items-baseline">
								<span class="font-bold">{props.data.display_name}</span>
								<small class="text-muted-foreground">
									{new Date(
										isPending()
											? (props.data as PendingMessageData).createdAt
											: (props.data as IndexedMessageData).created_at,
									).toLocaleDateString()}{" "}
									{new Date(
										isPending()
											? (props.data as PendingMessageData).createdAt
											: (props.data as IndexedMessageData).created_at,
									).toLocaleTimeString(undefined, {
										hour: "2-digit",
										minute: "2-digit",
									})}
								</small>
							</div>
						</Show>
						<p
							class="m-0"
							classList={{
								"text-muted-foreground": isPending(),
								"text-foreground": !isPending(),
							}}
						>
							{props.data.text}
						</p>
					</div>
					<Show when={!isPending()}>
						<div class="absolute top-0 right-4 transform -translate-y-1/2 hidden group-hover:flex flex-row h-8 bg-card border border-border rounded-sm overflow-hidden">
							<MessageAction tooltipText="Reply" onClick={enableReplyMode}>
								<Reply />
							</MessageAction>
							<MessageAction tooltipText="Edit" onClick={enableEditMode}>
								<Pencil />
							</MessageAction>
							<MessageDeletionDrawer
								message={props.data}
								addDeletedMessage={addDeletedMessage}
							>
								<MessageAction
									tooltipText="Delete"
									buttonClasses="text-destructive"
									onClick={(e) => {
										setMessageToBeDeleted(props.data as IndexedMessageData);
										handlePotentialDeletion(e);
									}}
								>
									<Trash />
								</MessageAction>
							</MessageDeletionDrawer>
						</div>
					</Show>
				</div>
			</div>
		</MessageContextMenu>
	);
};
