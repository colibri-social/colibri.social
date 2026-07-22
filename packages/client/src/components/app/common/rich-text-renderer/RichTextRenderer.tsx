import type { Accessor, Component } from "solid-js";
import { createSignal, For, Show } from "solid-js";
import { useCommunityContext } from "../../../../contexts/Community";
import { cx } from "../../../../utils/cva";
import { EMOJI_IMG_CLASS, emojiOnlyCount } from "../../../../utils/emoji";
import { slugForEmoji } from "../../../../utils/emoji-data";
import { EmojiInfo, type EmojiInfoTarget } from "./EmojiInfo";
import { renderWithFacets, type TextWithFacets } from "./util";

/**
 * A rich text renderer component that parses a given text and renders its facets as HTML.
 * Can be made editable using the `editable` prop.
 */
export const RichTextRenderer: Component<{
	text: Accessor<TextWithFacets>;
	classList?: Record<string, boolean>;
	id?: string;
	class?: string;
	isEdited?: boolean;
}> = (props) => {
	const community = useCommunityContext();

	const content = props.text();
	const rendered = renderWithFacets(content, community().community.uri);

	const emojiCount =
		!content.facets || content.facets.length === 0
			? emojiOnlyCount(content.text)
			: 0;
	const jumbomoji = emojiCount > 0 && emojiCount <= 27;

	const [emojiTarget, setEmojiTarget] = createSignal<EmojiInfoTarget | null>(
		null,
	);
	let openEmojiEl: HTMLImageElement | null = null;

	const closeEmojiInfo = () => {
		openEmojiEl = null;
		setEmojiTarget(null);
	};

	const handleClick = (event: MouseEvent) => {
		const target = event.target;
		if (
			!(target instanceof HTMLImageElement) ||
			!target.classList.contains(EMOJI_IMG_CLASS)
		) {
			return;
		}
		const slug = slugForEmoji(target.alt);
		if (!slug) return;
		event.preventDefault();
		event.stopPropagation();
		if (emojiTarget() && openEmojiEl === target) {
			closeEmojiInfo();
			return;
		}
		openEmojiEl = target;
		setEmojiTarget({
			char: target.alt,
			slug,
			rect: target.getBoundingClientRect(),
		});
	};

	return (
		<div
			class={cx(
				"m-0 text-foreground rich-text focus:outline-0 leading-7 break-after-auto relative min-w-0 [overflow-wrap:anywhere]",
				props.class,
			)}
			classList={{ ...props.classList, jumbomoji }}
			id={props.id}
			onClick={handleClick}
		>
			<For each={rendered}>{(component) => component}</For>
			<Show when={props.isEdited}>
				<span
					class="text-muted-foreground text-xs inline"
					classList={{ "ml-1": rendered.length === 1 }}
				>
					{" "}
					(edited)
				</span>
			</Show>
			<Show when={emojiTarget()} keyed>
				{(target) => <EmojiInfo target={target} onClose={closeEmojiInfo} />}
			</Show>
		</div>
	);
};
