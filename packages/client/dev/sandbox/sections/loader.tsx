import { createSignal, For } from "solid-js";
import { Hummingbird } from "../../../src/components/hummingbird";
import { HummingbirdLoader } from "../../../src/components/hummingbird/HummingbirdLoader";
import type { LoadingPhase } from "../../../src/components/hummingbird/loading-overlay-state";
import { Button } from "../../../src/components/ui/Button";
import { Demo } from "../helpers";
import type { SandboxCategory } from "../types";

const PHASES: Array<LoadingPhase> = ["connecting", "syncing"];

const MESSAGES: Record<LoadingPhase, string> = {
	connecting: "Logging in...",
	syncing: "Fetching user details...",
};

const BootLoaderDemo = () => {
	const [phase, setPhase] = createSignal<LoadingPhase>("syncing");
	const [tired, setTired] = createSignal(false);
	const [exiting, setExiting] = createSignal(false);
	const [flavor, setFlavor] = createSignal(true);

	const dart = () => {
		setExiting(true);
		setTimeout(() => setExiting(false), 1600);
	};

	return (
		<div class="flex flex-col gap-6">
			<Demo label="Phase">
				<For each={PHASES}>
					{(value) => (
						<Button
							variant={phase() === value ? "default" : "outline"}
							onClick={() => setPhase(value)}
						>
							{value}
						</Button>
					)}
				</For>
			</Demo>

			<Demo label="State">
				<Button
					variant={tired() ? "default" : "outline"}
					onClick={() => setTired((current) => !current)}
				>
					Tired
				</Button>
				<Button
					variant={flavor() ? "default" : "outline"}
					onClick={() => setFlavor((current) => !current)}
				>
					Flavor lines
				</Button>
				<Button variant="outline" onClick={dart}>
					Play exit
				</Button>
			</Demo>

			<div class="relative flex h-100 items-center justify-center overflow-hidden rounded-lg border border-border bg-background">
				<HummingbirdLoader
					phase={phase()}
					message={MESSAGES[phase()]}
					flavor={flavor()}
					tired={tired()}
					exiting={exiting()}
				/>
			</div>

			<p class="m-0 text-muted-foreground text-xs">
				Tap the bird to startle it. Turn on reduced motion in the OS to check
				the static fallback.
			</p>
		</div>
	);
};

const SizesDemo = () => (
	<Demo label="Sizes">
		<For each={[240, 160, 96, 48, 28]}>
			{(size) => (
				<div class="flex flex-col items-center gap-1">
					<Hummingbird size={size} />
					<span class="text-muted-foreground text-xs">{size}px</span>
				</div>
			)}
		</For>
	</Demo>
);

const FlippedDemo = () => (
	<Demo label="Flipped">
		<Hummingbird size={160} />
		<Hummingbird size={160} flipped />
	</Demo>
);

export const LOADER: SandboxCategory = {
	id: "loader",
	title: "Loader",
	items: [
		{ id: "boot-loader", title: "Boot loader", component: BootLoaderDemo },
		{ id: "bird-sizes", title: "Sizes", component: SizesDemo },
		{ id: "bird-flipped", title: "Flipped", component: FlippedDemo },
	],
};
