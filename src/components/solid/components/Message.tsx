import {
	type Component,
	createSignal,
	Match,
	type ParentComponent,
	Show,
	Switch,
} from "solid-js";
import type { IndexedMessageData } from "@/utils/sdk";
import {
	useGlobalContext,
	type GlobalContextUtility,
	type PendingMessageData,
} from "../contexts/GlobalContext";
import { Pencil } from "../icons/Pencil";
import { Trash } from "../icons/Trash";
import { MessageAction } from "./MessageAction";
import { actions } from "astro:actions";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuPortal,
	ContextMenuTrigger,
} from "../shadcn-solid/ContextMenu";
import { useParams } from "@solidjs/router";
import {
	Drawer,
	DrawerContent,
	DrawerHeader,
	DrawerPortal,
	DrawerTrigger,
	DrawerLabel,
	DrawerDescription,
	DrawerFooter,
	DrawerClose,
} from "../shadcn-solid/Drawer";
import createMediaQuery from "@/utils/create-media-query";
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
import { Button } from "../shadcn-solid/Button";

const [messageToBeDeleted, setMessageToBeDeleted] =
	createSignal<IndexedMessageData>();
const [deletionModalOpen, setDeletionModalOpen] = createSignal(false);

const deleteMessageAndCloseModal = (
	addDeletedMessage: GlobalContextUtility["addDeletedMessage"],
) => {
	const message = messageToBeDeleted()!;
	console.log(message);

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
	const [_, { addDeletedMessage }] = useGlobalContext();
	const isPending = () => "hash" in props.data;

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

	return (
		<MessageContextMenu
			disabled={isPending()}
			enableEditMode={enableEditMode}
			handlePotentialDeletion={handlePotentialDeletion}
			data={props.data}
			addDeletedMessage={addDeletedMessage}
		>
			<div
				class={`w-full h-fit flex flex-row px-4 gap-4 group relative hover:bg-card/50`}
				classList={{
					"py-0": props.isSubsequent,
					"pb-0 pt-1": !props.isSubsequent,
				}}
			>
				<Switch>
					<Match when={!props.isSubsequent}>
						<img
							src={props.data.avatar_url || "/logo.png"}
							alt={props.data.display_name}
							class="w-10 h-10 min-w-10 min-h-10 bg-muted rounded-full border border-border"
							loading="lazy"
						/>
					</Match>
					<Match when={props.isSubsequent}>
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
					<Show when={!props.isSubsequent}>
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
		</MessageContextMenu>
	);
};
