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
import { parseEntryId } from "../../screens/admin/channel/channel-target";
import type { Layer } from "../layers";
import { useStack } from "../stack";

export type ModalAreaProps = {
	layers: Layer[];
	depth: number;
};

type Area =
	| "space"
	| "channel"
	| "create"
	| "settings"
	| "inbox"
	| "createSpace"
	| "discover"
	| "join"
	| "pack";

const areas: Record<Area, (props: ModalAreaProps) => JSX.Element> = {
	space: lazy(() => import("../../screens/admin/desktop/space-settings-modal")),
	channel: lazy(
		() => import("../../screens/admin/desktop/channel-settings-modal"),
	),
	create: lazy(() => import("../../screens/admin/desktop/create-modal")),
	settings: lazy(() => import("../../screens/settings/desktop/settings-modal")),
	inbox: lazy(() => import("../../screens/inbox/desktop-modal")),
	createSpace: lazy(() => import("../../screens/create-space/desktop-modal")),
	discover: lazy(() => import("../../screens/discover/desktop-modal")),
	join: lazy(() => import("../../screens/join/desktop-modal")),
	pack: lazy(() => import("../../screens/pack/desktop-modal")),
};

const CREATABLE: readonly string[] = ["channel", "category"];

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
		if (CREATABLE.includes(layer.page) && parseEntryId(layer.id).creating) {
			return "create";
		}
		return STANDALONE.includes(layer.page) ? "channel" : "space";
	}
	if (layer.kind === "settings") return "settings";
	if (layer.kind === "inbox") return "inbox";
	if (layer.kind === "createSpace") return "createSpace";
	if (layer.kind === "discover") return "discover";
	if (layer.kind === "join") return "join";
	if (layer.kind === "pack") return "pack";
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
