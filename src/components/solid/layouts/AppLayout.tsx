import { A, useNavigate } from "@solidjs/router";
import {
	closestCenter,
	createSortable,
	DragDropProvider,
	DragDropSensors,
	type DragEvent,
	DragOverlay,
	SortableProvider,
	useDragDropContext,
} from "@thisbeyond/solid-dnd";
import { For, Match, type ParentComponent, Show, Switch } from "solid-js";
import type { CommunityData } from "@/utils/sdk";
import { NewCommunityModal } from "../components/NewCommunityModal";
import { useGlobalContext } from "../contexts/GlobalContext";
import { Gear } from "../icons/Gear";
import { House } from "../icons/House";
import { Plus } from "../icons/Plus";

const CommunityAvatar = (props: { item: CommunityData; class?: string }) => (
	<Switch>
		<Match when={props.item.picture}>
			<img
				src={props.item.picture}
				alt={props.item.name}
				class={`w-10 h-10 rounded-md pointer-events-none select-none object-cover ${props.class ?? ""}`}
			/>
		</Match>
		<Match when={!props.item.picture}>
			<span class="font-bold">
				{props.item.name
					.split(" ")
					.map((x) => x.substring(0, 1))
					.join("")
					.substring(0, 3)}
			</span>
		</Match>
	</Switch>
);

const SortableCommunity = (props: { item: CommunityData }) => {
	const sortable = createSortable(props.item.rkey);
	const [, { onDragStart, onDragEnd: onDndDragEnd }] = useDragDropContext()!;

	let didDrag = false;
	let el: HTMLDivElement | undefined;

	onDragStart(({ draggable }) => {
		if (draggable.id === props.item.rkey) {
			didDrag = true;
			el?.style.removeProperty("transition");
		} else {
			el?.style.setProperty("transition", "transform 200ms ease");
		}
	});

	onDndDragEnd(() => {
		el?.style.removeProperty("transition");
		// Allow a tick for the click event to fire and be suppressed, then reset
		didDrag = false;
	});

	const handleClick = (e: MouseEvent) => {
		if (didDrag) {
			e.preventDefault();
		}
	};

	return (
		<div
			ref={(node) => {
				el = node;
				sortable.ref(node);
			}}
			classList={{ "opacity-25": sortable.isActiveDraggable }}
			style={{ "touch-action": "none" }}
			{...sortable.dragActivators}
		>
			<A
				href={`/c/${props.item.rkey}`}
				class="w-10 h-10 rounded-md bg-muted flex items-center justify-center"
				activeClass="outline outline-foreground outline-2 -outline-offset-2"
				onClick={handleClick}
				draggable={false}
			>
				<CommunityAvatar item={props.item} />
			</A>
		</div>
	);
};

const CommunitySidebar = (props: { communities: CommunityData[] }) => {
	return (
		<>
			<DragDropSensors />
			<SortableProvider ids={props.communities.map((c) => c.rkey)}>
				<For each={props.communities}>
					{(item) => <SortableCommunity item={item} />}
				</For>
			</SortableProvider>
			<DragOverlay>
				{(draggable) => {
					const item = draggable
						? props.communities.find((c) => c.rkey === draggable.id)
						: undefined;
					return (
						<Show when={item}>
							{(resolved) => (
								<div class="sortable">
									<CommunityAvatar item={resolved()} />
								</div>
							)}
						</Show>
					);
				}}
			</DragOverlay>
		</>
	);
};

const AppLayout: ParentComponent = (props) => {
	const [globalState, { setCommunities }] = useGlobalContext();
	const navigate = useNavigate();

	if (
		window.location.pathname === "/app" &&
		globalState.communities.length > 0
	) {
		navigate(`/c/${globalState.communities[0].rkey}`);
	}

	const onDragEnd = ({ draggable, droppable }: DragEvent) => {
		if (!draggable || !droppable) return;

		const communities = globalState.communities;
		const fromIndex = communities.findIndex((c) => c.rkey === draggable.id);
		const toIndex = communities.findIndex((c) => c.rkey === droppable.id);

		if (fromIndex === toIndex) return;

		const reordered = communities.slice();
		reordered.splice(toIndex, 0, ...reordered.splice(fromIndex, 1));
		setCommunities(reordered);
	};

	return (
		<div class="flex flex-col w-screen h-screen bg-card">
			<div class="flex w-full h-10 min-h-10 pl-2 items-center gap-2">
				<img src="/logo.png" width={32} height={32} alt="Colibri Social logo" />
				<span class="font-black text-lg bg-clip-text text-transparent bg-[linear-gradient(69deg,#090615_-145.97%,#31226D_-87.27%,#6C5AA6_-26.22%,#AE99CB_30.13%,#E0DEEC_75.92%)]">
					colibri.social
				</span>
			</div>
			<div class="flex h-full w-full">
				<aside class="flex flex-col h-full w-14 p-2 pb-3">
					<nav class="w-full h-full flex flex-col gap-2">
						<div class="w-full h-full flex flex-col gap-2">
							<div class="w-10 flex h-10 rounded-md bg-muted items-center justify-center cursor-pointer">
								<House />
							</div>
							<hr class="m-0 border-muted" />
							<DragDropProvider
								onDragEnd={onDragEnd}
								collisionDetector={closestCenter}
							>
								<CommunitySidebar communities={globalState.communities} />
							</DragDropProvider>

							<NewCommunityModal navigate={navigate}>
								<button
									type="button"
									class="w-10 flex h-10 rounded-md bg-muted items-center justify-center cursor-pointer"
								>
									<Plus />
								</button>
							</NewCommunityModal>
						</div>
					</nav>
					<div class="w-10 flex h-10 rounded-md bg-muted items-center justify-center cursor-pointer">
						<div class="block w-fit h-fit">
							<Gear />
						</div>
					</div>
				</aside>
				<main class="w-full h-full">{props.children}</main>
			</div>
		</div>
	);
};

export default AppLayout;
