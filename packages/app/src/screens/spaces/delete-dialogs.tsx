import {
	Button,
	ConfirmDialog,
	Modal,
	ModalContent,
	TextField,
	toast,
} from "@colibri-social/ui";
import { createSignal, Show } from "solid-js";
import { useData } from "../../data/store";
import type { CategoryView, ChannelView, Did } from "../../data/types";
import { CHANNEL_NAME_MAX } from "../admin/channel/channel.contract";
import { whenOverlaysClosed } from "../channel/forward/overlay-wait";

export const DELETE_COPY = {
	channelTitle: (name: string) => `Delete #${name}?`,
	channelDescription:
		"Type the channel's name to confirm. Messages members wrote here stay in their own repos, but nobody except their authors can read them afterward. This can't be undone.",
	channelFailed: "Couldn't delete the channel",
	channelDeleted: (name: string) => `Deleted #${name}`,
	categoryTitle: (name: string) => `Delete ${name}?`,
	categoryDescription:
		"This deletes the category. Channels inside it aren't deleted and move to the top of the list. This can't be undone.",
	categoryFailed: "Couldn't delete the category",
	categoryDeleted: (name: string) => `Deleted ${name}`,
} as const;

export const createDeleteDialogs = (options: {
	onChannelDeleted?: (channel: ChannelView) => void;
}) => {
	const data = useData();
	const [channel, setChannel] = createSignal<ChannelView>();
	const [channelOpen, setChannelOpen] = createSignal(false);
	const [confirmation, setConfirmation] = createSignal("");
	const [deleting, setDeleting] = createSignal(false);
	const [category, setCategory] = createSignal<{
		community: Did;
		view: CategoryView;
	}>();
	const [categoryOpen, setCategoryOpen] = createSignal(false);

	const requestChannel = (view: ChannelView) => {
		setChannel(view);
		setConfirmation("");
		setDeleting(false);
		void whenOverlaysClosed().then(() => setChannelOpen(true));
	};

	const requestCategory = (community: Did, view: CategoryView) => {
		setCategory({ community, view });
		void whenOverlaysClosed().then(() => setCategoryOpen(true));
	};

	const matches = () => {
		const view = channel();
		return !!view && confirmation() === view.name;
	};

	const removeChannel = async () => {
		const view = channel();
		if (!view || !matches() || deleting()) return;
		setDeleting(true);
		try {
			await data.channels.remove(view);
			setChannelOpen(false);
			toast.success(DELETE_COPY.channelDeleted(view.name));
			options.onChannelDeleted?.(view);
		} catch {
			toast.error(DELETE_COPY.channelFailed);
		} finally {
			setDeleting(false);
		}
	};

	const removeCategory = async () => {
		const target = category();
		if (!target) return;
		try {
			await data.categories.remove(target.community, target.view);
		} catch (error) {
			toast.error(DELETE_COPY.categoryFailed);
			throw error;
		}
		toast.success(DELETE_COPY.categoryDeleted(target.view.name));
	};

	const Dialogs = () => (
		<>
			<Modal
				open={channelOpen()}
				onOpenChange={(open) => {
					if (!open && deleting()) return;
					setChannelOpen(open);
				}}
			>
				<ModalContent
					title={DELETE_COPY.channelTitle(channel()?.name ?? "")}
					description={DELETE_COPY.channelDescription}
					footer={
						<>
							<Button
								variant="secondary"
								disabled={deleting()}
								onClick={() => setChannelOpen(false)}
							>
								Cancel
							</Button>
							<Button
								variant="destructive"
								disabled={!matches()}
								loading={deleting()}
								onClick={() => void removeChannel()}
							>
								Delete channel
							</Button>
						</>
					}
				>
					<form
						data-delete-channel=""
						onSubmit={(event) => {
							event.preventDefault();
							void removeChannel();
						}}
					>
						<TextField
							label="Channel name"
							value={confirmation()}
							onChange={setConfirmation}
							placeholder={channel()?.name}
							maxLength={CHANNEL_NAME_MAX}
							disabled={deleting()}
							autocomplete="off"
						/>
					</form>
				</ModalContent>
			</Modal>
			<Show when={category()}>
				{(target) => (
					<ConfirmDialog
						open={categoryOpen()}
						onOpenChange={setCategoryOpen}
						title={DELETE_COPY.categoryTitle(target().view.name)}
						description={DELETE_COPY.categoryDescription}
						confirmLabel="Delete category"
						tone="destructive"
						onConfirm={removeCategory}
					/>
				)}
			</Show>
		</>
	);

	return { requestChannel, requestCategory, Dialogs };
};
