import {
	FeaturedBridgeCard,
	SectionLabel,
	StatusScreen,
} from "@colibri-social/ui";
import { DangerTriangleIcon } from "@solar-icons/solid/bold/danger-triangle";
import { createUniqueId, For, Show } from "solid-js";
import { defineContract, slot } from "../../../screen/define";
import type { AdminArgs } from "../../../shell/registry";
import { FEATURED_BRIDGES } from "../bridges/bridge-catalog";
import { useBridgeAdmin } from "../bridges/pairing";
import { AdminNavHeader } from "../desktop/page-header";

export const bridgeNew = defineContract({
	id: "adminBridgeNew",
	model: (args: AdminArgs) => {
		const bridge = useBridgeAdmin(args);
		return {
			...bridge,
			featured: FEATURED_BRIDGES,
			connect: (featured: string) =>
				bridge.stack.push({
					kind: "admin",
					space: args.space,
					page: "bridge-connect",
					id: featured,
				}),
			haveCode: () =>
				bridge.stack.push({
					kind: "admin",
					space: args.space,
					page: "bridge-code",
				}),
		};
	},
	slots: {
		Header: slot((m) => (
			<AdminNavHeader
				safeTop
				kind="back"
				navigateLabel="Back to Bridges"
				onNavigate={() => m.stack.pop()}
				title="New Bridge"
				action={
					m.unavailable()
						? undefined
						: { type: "text", label: "I have a code", onClick: m.haveCode }
				}
			/>
		)),
		Unavailable: slot((m) => (
			<Show when={m.unavailable()}>
				{(copy) => (
					<StatusScreen
						tone="destructive"
						icon={<DangerTriangleIcon />}
						title={copy().title}
						description={copy().description}
					/>
				)}
			</Show>
		)),
		Featured: slot((m) => {
			const labelId = createUniqueId();
			return (
				<section aria-labelledby={labelId} class="flex flex-col gap-4">
					<SectionLabel id={labelId} label="Featured Bridges" />
					<ul
						data-bridge-grid="featured"
						class="m-0 flex list-none flex-col gap-4 p-0"
					>
						<For each={m.featured}>
							{(entry) => (
								<li class="min-w-0">
									<FeaturedBridgeCard
										name={entry.name}
										verified={entry.verified}
										author={entry.author}
										features={entry.features}
										onAction={() => m.connect(entry.id)}
									/>
								</li>
							)}
						</For>
					</ul>
				</section>
			);
		}),
	},
});
