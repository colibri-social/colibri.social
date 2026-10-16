import { Show } from "solid-js";
import { adminEmojiPack } from "./emoji-pack.contract";

export default adminEmojiPack.view({
	render: ({ slots: s, model: m }) => (
		<div class="flex min-h-0 flex-1 flex-col bg-popover">
			<s.Header />
			<div
				data-scroll-y=""
				class="min-h-0 flex-1 overflow-y-auto overscroll-contain"
			>
				<Show
					when={!m.missing() && !m.gone() && m.canManage()}
					fallback={
						<div class="flex min-h-full flex-col">
							<s.Unavailable />
						</div>
					}
				>
					<div class="flex min-h-full flex-col gap-6 p-4 pb-safe-offset-6">
						<s.Name />
						<div aria-hidden="true" class="h-px w-full bg-accent" />
						<s.Search />
						<s.Upload />
						<s.Emojis />
						<Show when={!m.creating}>
							<div aria-hidden="true" class="h-px w-full bg-accent" />
						</Show>
						<s.Danger />
						<s.Bar />
					</div>
				</Show>
			</div>
			<s.Overlays />
		</div>
	),
});
