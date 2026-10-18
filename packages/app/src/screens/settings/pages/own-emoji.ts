import { createMemo, createSignal } from "solid-js";
import type { DataStore } from "../../../data/store";
import type { EmojiCatalogOwner } from "../../admin/emoji-pack/pack-editor";

const [editingPack, setEditingPack] = createSignal<string>();

export { editingPack, setEditingPack };

export const ownEmoji = (data: DataStore): EmojiCatalogOwner => {
	const catalog = () => data.emoji.own();
	const view = () => catalog().value();
	const takenNames = createMemo(
		() => new Set((view()?.emojis ?? []).map((emoji) => emoji.name)),
	);
	return {
		owner: () => data.viewer.did,
		data,
		view,
		loading: () => catalog().loading() && !view(),
		takenNames,
		uploaderOf: () => undefined,
	};
};

export const OWN_EMOJI_DELETE_DESCRIPTION =
	"It's removed from your emoji, and messages that use it show the plain shortcode.";
