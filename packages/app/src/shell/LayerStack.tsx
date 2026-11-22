import { For, type JSX, onCleanup, onMount, Show } from "solid-js";
import { isSheetLayer, type Layer } from "./layers";
import { type Stack, StackContext } from "./stack";

const LayerFrame = (props: {
	stack: Stack;
	index: number;
	children: JSX.Element;
}) => {
	let frame: HTMLDivElement | undefined;
	let scrim: HTMLDivElement | undefined;
	let edge: HTMLDivElement | undefined;
	const index = props.index;
	const sheet = index > 0 && isSheetLayer(props.stack.mounted()[index - 1]);

	onMount(() => {
		if (!frame) return;
		const entry = { frame, scrim, edge };
		props.stack.registerFrame(index, entry);
		onCleanup(() => props.stack.unregisterFrame(index, entry));
		if (sheet) onCleanup(props.stack.bindSheet(frame, index));
	});

	const inactive = () => props.stack.activeDepth() !== index;

	return (
		<>
			<Show when={index > 0}>
				<div
					ref={scrim}
					aria-hidden="true"
					data-pane-scrim=""
					class="pointer-events-none absolute inset-0 bg-black will-change-[opacity]"
					style={{ "z-index": index * 2, visibility: "hidden", opacity: 0 }}
				/>
			</Show>
			<div
				ref={frame}
				data-pane=""
				data-pane-index={index}
				data-pane-sheet={sheet ? "" : undefined}
				data-pane-active={inactive() ? undefined : ""}
				aria-hidden={inactive() || undefined}
				class="absolute inset-0 isolate"
				style={{ "z-index": index * 2 + 1 }}
			>
				<Show when={index > 0}>
					<div
						ref={edge}
						aria-hidden="true"
						data-pane-edge=""
						class="pointer-events-none absolute inset-y-0 right-full w-6 bg-linear-to-l from-black/35 to-transparent"
						style={{ visibility: "hidden" }}
					/>
				</Show>
				<div class="absolute inset-0 flex flex-col overflow-hidden bg-background">
					{props.children}
				</div>
			</div>
		</>
	);
};

export const LayerStack = (props: {
	stack: Stack;
	base: JSX.Element;
	renderLayer: (layer: Layer) => JSX.Element;
}) => (
	<StackContext.Provider value={props.stack}>
		<div
			ref={(node) => props.stack.attach(node)}
			data-pane-stack=""
			class="relative h-full w-full overflow-hidden overscroll-none"
		>
			<LayerFrame stack={props.stack} index={0}>
				{props.base}
			</LayerFrame>
			<For each={props.stack.mounted()}>
				{(layer, index) => (
					<LayerFrame stack={props.stack} index={index() + 1}>
						{props.renderLayer(layer)}
					</LayerFrame>
				)}
			</For>
		</div>
	</StackContext.Provider>
);
