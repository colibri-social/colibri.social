import {
	CategorySkeleton,
	ChannelListHeaderSkeleton,
	SpaceRail,
} from "@colibri-social/ui";
import { Show } from "solid-js";
import { Outlet } from "../../shell/desktop/context";
import { desktopRailPaddingTop } from "../../shell/desktop/window-chrome";
import InboxScreen from "../inbox/inbox.screen";
import { spaces } from "./spaces.contract";

export default spaces.view({
	hidden: ["Missing"],
	render: ({ slots: s, model: m }) => (
		<>
			<Outlet name="rail">
				<SpaceRail
					platform="desktop"
					paddingTop={desktopRailPaddingTop()}
					leading={<InboxScreen args={{}} />}
					onCreate={m.openCreateSpace}
					onDiscover={m.openDiscover}
				>
					<s.RailItems platform="desktop" />
				</SpaceRail>
			</Outlet>
			<div
				data-spaces-desktop=""
				class="min-h-0 flex-1 overflow-y-auto overscroll-contain"
			>
				<Show
					when={!m.missing()}
					fallback={
						<div class="flex min-h-full flex-col">
							<s.Missing />
						</div>
					}
				>
					<Show
						when={m.community()}
						fallback={<ChannelListHeaderSkeleton platform="desktop" />}
					>
						<s.Header platform="desktop" />
					</Show>
					<Show
						when={!m.space()?.categories.loading()}
						fallback={
							<>
								<CategorySkeleton
									platform="desktop"
									density={
										m.data.controls().showMessagePreviews
											? "default"
											: "compact"
									}
								/>
								<CategorySkeleton
									platform="desktop"
									density={
										m.data.controls().showMessagePreviews
											? "default"
											: "compact"
									}
								/>
							</>
						}
					>
						<s.Channels platform="desktop" />
					</Show>
				</Show>
			</div>
		</>
	),
});
