import { BlockUserDialog, toast } from "@colibri-social/ui";
import { createSignal, Show } from "solid-js";
import { useData } from "../../data/store";
import type { Did } from "../../data/types";
import { whenOverlaysClosed } from "../channel/forward/overlay-wait";

type BlockTarget = { did: string; name: string };

export const BLOCK_TOAST_COPY = {
	blocked: (name: string) => `Blocked ${name}`,
	unblocked: (name: string) => `Unblocked ${name}`,
	blockFailed: (name: string) =>
		`Couldn't block ${name}. Check your connection and try again.`,
	unblockFailed: (name: string) =>
		`Couldn't unblock ${name}. Check your connection and try again.`,
} as const;

export const createBlockFlow = () => {
	const data = useData();
	const [target, setTarget] = createSignal<BlockTarget>();
	const [open, setOpen] = createSignal(false);

	const canBlock = (did: string) => {
		return did !== data.viewer.did;
	};

	const isBlocked = (did: string) => {
		return data.preferences.isBlocked(did);
	};

	const save = async (did: string, name: string, blocked: boolean) => {
		const saved = await data.preferences.setBlocked(did as Did, blocked);

		if (!saved) {
			toast.error(
				blocked
					? BLOCK_TOAST_COPY.blockFailed(name)
					: BLOCK_TOAST_COPY.unblockFailed(name),
			);
			return false;
		}

		toast.success(
			blocked
				? BLOCK_TOAST_COPY.blocked(name)
				: BLOCK_TOAST_COPY.unblocked(name),
		);

		return true;
	};

	const ask = (did: string, name: string) => {
		setTarget({ did, name });
		void whenOverlaysClosed().then(() => setOpen(true));
	};

	const unblock = (did: string, name: string) => {
		return save(did, name, false);
	};

	const Dialog = () => {
		return (
			<Show when={target()}>
				{(current) => (
					<BlockUserDialog
						open={open()}
						onOpenChange={setOpen}
						name={current().name}
						onConfirm={() => {
							void save(current().did, current().name, true);
						}}
					/>
				)}
			</Show>
		);
	};

	return { canBlock, isBlocked, ask, unblock, Dialog };
};
