import { Modal } from "@colibri-social/ui";
import {
	createEffect,
	createMemo,
	createSignal,
	type JSX,
	lazy,
	onCleanup,
	Show,
	Suspense,
} from "solid-js";
import { Dynamic } from "solid-js/web";
import type { Layer } from "../layers";
import { useStack } from "../stack";

export type ModalAreaProps = {
	layers: Layer[];
	depth: number;
};

type Area =
	| "space"
	| "channel"
	| "settings"
	| "createSpace"
	| "discover"
	| "join";

const areas: Record<Area, (props: ModalAreaProps) => JSX.Element> = {
	space: lazy(() => import("../../screens/admin/desktop/space-settings-modal")),
	channel: lazy(
		() => import("../../screens/admin/desktop/channel-settings-modal"),
	),
	settings: lazy(() => import("../../screens/settings/desktop/settings-modal")),
	createSpace: lazy(() => import("../../screens/create-space/desktop-modal")),
	discover: lazy(() => import("../../screens/discover/desktop-modal")),
	join: lazy(() => import("../../screens/join/desktop-modal")),
};

const STANDALONE: readonly string[] = [
	"channel",
	"channel-permissions",
	"channel-audience",
	"category",
	"category-permissions",
	"category-audience",
];

export const areaOf = (layer: Layer | undefined): Area | undefined => {
	if (!layer) return undefined;
	if (layer.kind === "admin") {
		return STANDALONE.includes(layer.page) ? "channel" : "space";
	}
	if (layer.kind === "settings") return "settings";
	if (layer.kind === "createSpace") return "createSpace";
	if (layer.kind === "discover") return "discover";
	if (layer.kind === "join") return "join";
	return undefined;
};

type Held = { name: Area; layers: Layer[]; depth: number };

const EXIT_MS = 400;

export const ModalHost = (props: { layers: Layer[]; depth: number }) => {
	const stack = useStack();
	const area = createMemo(() => areaOf(props.layers[0]));
	const [held, setHeld] = createSignal<Held>();
	let clear: ReturnType<typeof setTimeout> | undefined;
	createEffect(() => {
		const name = area();
		clearTimeout(clear);
		if (name) {
			setHeld({ name, layers: props.layers, depth: props.depth });
			return;
		}
		clear = setTimeout(() => setHeld(undefined), EXIT_MS);
	});
	onCleanup(() => clearTimeout(clear));
	return (
		<Show when={held()?.name} keyed>
			{(name) => (
				<Modal
					open={!!area()}
					onOpenChange={(open) => {
						if (!open) stack.popTo(held()?.depth ?? props.depth);
					}}
				>
					<Suspense>
						<Dynamic
							component={areas[name]}
							layers={held()?.layers ?? []}
							depth={held()?.depth ?? props.depth}
						/>
					</Suspense>
				</Modal>
			)}
		</Show>
	);
};
