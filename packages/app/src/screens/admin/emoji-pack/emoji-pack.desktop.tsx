import { Show } from "solid-js";
import { adminEmojiPack } from "./emoji-pack.contract";

export default adminEmojiPack.view({
	render: ({ slots: s, model: m }) => (
		<>
			<s.Header />
			<Show
				when={!m.missing() && !m.gone() && m.canManage()}
				fallback={<s.Unavailable />}
			>
				<s.Name />
				<div aria-hidden="true" class="h-px w-full bg-accent" />
				<s.Search />
				<s.Upload />
				<s.Emojis />
				<Show when={!m.creating}>
					<div aria-hidden="true" class="h-px w-full bg-accent" />
				</Show>
				<s.Danger />
			</Show>
			<s.Overlays />
		</>
	),
});
