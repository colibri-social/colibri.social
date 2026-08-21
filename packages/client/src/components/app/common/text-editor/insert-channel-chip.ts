import type { Community as CommunityView } from "@colibri-social/lib";
import { closeHistory } from "prosemirror-history";
import type { EditorView } from "prosemirror-view";
import {
	type ChannelChip,
	loadCommunityChannels,
	resolveChannelChip,
	UNRESOLVED_CHANNEL_LABEL,
} from "../../../../atproto/channel-reference";
import type { ChannelUrlTarget } from "../../../../atproto/colibri-channel-url";
import type { XrpcClient } from "../../../../atproto/xrpc";
import type { Category } from "../../../../atproto/xrpc/social/colibri/community/listCategories";
import type { Channel } from "../../../../atproto/xrpc/social/colibri/community/listChannels";

export type ChipContext = {
	xrpc: XrpcClient;
	communities: Array<CommunityView>;
	channels: Array<Channel>;
	categories: Array<Category>;
	currentCommunityUri?: string;
	ns?: string;
};

export const channelChipAttrs = (channelUri: string, chip: ChannelChip) => ({
	id: channelUri,
	label: chip.label,
	handle: null,
	avatar: chip.avatar ?? null,
	community: chip.community ?? null,
	category: chip.category ?? null,
	type: "channel" as const,
});

const relabel = (
	view: EditorView,
	channelUri: string,
	chip: ChannelChip,
): void => {
	if (view.isDestroyed) return;

	const mention = view.state.schema.nodes.mention;
	if (!mention) return;

	const positions: Array<number> = [];
	view.state.doc.descendants((node, pos) => {
		if (node.type !== mention) return;
		if (node.attrs.id !== channelUri) return;
		if (node.attrs.label !== UNRESOLVED_CHANNEL_LABEL) return;
		positions.push(pos);
	});
	if (positions.length === 0) return;

	const tr = view.state.tr;
	tr.setMeta("addToHistory", false);
	for (const pos of positions) {
		tr.setNodeMarkup(pos, undefined, channelChipAttrs(channelUri, chip));
	}
	view.dispatch(tr);
};

export const insertChannelChip = (
	view: EditorView,
	text: string,
	target: ChannelUrlTarget,
	context: ChipContext,
): void => {
	const mention = view.state.schema.nodes.mention;
	if (!mention) return;

	view.dispatch(view.state.tr.insertText(text));

	const to = view.state.selection.from;
	const from = to - text.length;

	const chip = resolveChannelChip(
		target.channelUri,
		context.channels,
		context.communities,
		context.currentCommunityUri,
		context.categories,
	);

	const tr = view.state.tr;
	closeHistory(tr);
	tr.replaceWith(from, to, [
		mention.create(channelChipAttrs(target.channelUri, chip)),
		view.state.schema.text(" "),
	]);
	view.dispatch(tr);
	view.focus();

	if (chip.label !== UNRESOLVED_CHANNEL_LABEL) return;

	void loadCommunityChannels(
		context.xrpc,
		target.communityUri,
		context.ns,
	).then(() => {
		const resolved = resolveChannelChip(
			target.channelUri,
			context.channels,
			context.communities,
			context.currentCommunityUri,
			context.categories,
		);
		if (resolved.label !== UNRESOLVED_CHANNEL_LABEL) {
			relabel(view, target.channelUri, resolved);
		}
	});
};
