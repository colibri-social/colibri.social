import { closeHistory } from "prosemirror-history";
import type { EditorView } from "prosemirror-view";
import {
	type ChannelChip,
	loadCommunityChannels,
	resolveChannelChip,
	UNRESOLVED_CHANNEL_LABEL,
} from "../../../../atproto/channel-reference";
import type { ChannelUrlTarget } from "../../../../atproto/colibri-channel-url";
import type {
	CategoryView,
	ChannelView,
	CommunityView,
} from "../../../../atproto/views";
import type { ColibriClient } from "../../../../atproto/xrpc";

export type ChipContext = {
	xrpc: ColibriClient;
	communities: Array<CommunityView>;
	channels: Array<ChannelView>;
	categories: Array<CategoryView>;
	currentCommunityDid?: string;
};

export const channelChipAttrs = (channelSkey: string, chip: ChannelChip) => ({
	id: channelSkey,
	label: chip.label,
	handle: null,
	avatar: chip.avatar ?? null,
	community: chip.community ?? null,
	category: chip.category ?? null,
	type: "channel" as const,
});

const relabel = (
	view: EditorView,
	channelSkey: string,
	chip: ChannelChip,
): void => {
	if (view.isDestroyed) return;

	const mention = view.state.schema.nodes.mention;
	if (!mention) return;

	const positions: Array<number> = [];
	view.state.doc.descendants((node, pos) => {
		if (node.type !== mention) return;
		if (node.attrs.id !== channelSkey) return;
		if (node.attrs.label !== UNRESOLVED_CHANNEL_LABEL) return;
		positions.push(pos);
	});
	if (positions.length === 0) return;

	const tr = view.state.tr;
	tr.setMeta("addToHistory", false);
	for (const pos of positions) {
		tr.setNodeMarkup(pos, undefined, channelChipAttrs(channelSkey, chip));
	}
	view.dispatch(tr);
};

export const insertChannelChip = (
	view: EditorView,
	text: string,
	target: ChannelUrlTarget,
	context: ChipContext,
): boolean => {
	if (target.community !== context.currentCommunityDid) return false;

	const mention = view.state.schema.nodes.mention;
	if (!mention) return false;

	view.dispatch(view.state.tr.insertText(text));

	const to = view.state.selection.from;
	const from = to - text.length;

	const chip = resolveChannelChip(
		target.channelSpace,
		context.channels,
		context.communities,
		context.currentCommunityDid,
		context.categories,
	);

	const tr = view.state.tr;
	closeHistory(tr);
	tr.replaceWith(from, to, [
		mention.create(channelChipAttrs(target.channelSkey, chip)),
		view.state.schema.text(" "),
	]);
	view.dispatch(tr);
	view.focus();

	if (chip.label !== UNRESOLVED_CHANNEL_LABEL) return true;

	void loadCommunityChannels(context.xrpc, target.community).then(() => {
		const resolved = resolveChannelChip(
			target.channelSpace,
			context.channels,
			context.communities,
			context.currentCommunityDid,
			context.categories,
		);
		if (resolved.label !== UNRESOLVED_CHANNEL_LABEL) {
			relabel(view, target.channelSkey, resolved);
		}
	});

	return true;
};
