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
import {
	createSignal,
	For,
	Match,
	type ParentComponent,
	Show,
	Switch,
} from "solid-js";
import { Icon } from "@/components/solid/icons/Icon";
import type { CommunityData } from "@/utils/sdk";
import { NewCommunityModal } from "../components/NewCommunityModal";
import { UserSettingsModal } from "../components/UserSettingsModal";
import { useGlobalContext } from "../contexts/GlobalContext";
import { Button } from "../shadcn-solid/Button";
import {
	animateToNewPositions,
	capturePositions,
	reorderList,
} from "../utils/drag";

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

const SortableCommunity = (props: {
	item: CommunityData;
	draggedItem: CommunityData | undefined;
}) => {
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
			classList={{ "opacity-50": sortable.isActiveDraggable }}
			style={{ "touch-action": "none" }}
			{...sortable.dragActivators}
		>
			<Show when={sortable.isActiveDroppable && props.draggedItem}>
				{(resolved) => (
					<div class="absolute inset-0 rounded-md flex items-center justify-center opacity-40 pointer-events-none z-10">
						<CommunityAvatar item={resolved()} />
					</div>
				)}
			</Show>
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

const CommunitySidebar = (props: {
	communities: CommunityData[];
	draggedItem: CommunityData | undefined;
	onItemRef: (rkey: string, el: HTMLElement) => void;
}) => {
	return (
		<>
			<DragDropSensors />
			<SortableProvider ids={props.communities.map((c) => c.rkey)}>
				<For each={props.communities}>
					{(item) => (
						<div
							class="relative"
							ref={(node) => props.onItemRef(item.rkey, node)}
						>
							<SortableCommunity item={item} draggedItem={props.draggedItem} />
						</div>
					)}
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
								<div class="w-10 h-10 rounded-md bg-muted flex items-center justify-center opacity-90 shadow-lg">
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
	const [globalState, { setCommunities, setMemberListVisible }] =
		useGlobalContext();
	const navigate = useNavigate();

	const sortedCommunities = () =>
		globalState.communities.toSorted(
			(a, b) =>
				globalState.user.communities.indexOf(a.rkey) -
				globalState.user.communities.indexOf(b.rkey),
		);

	if (
		window.location.pathname === "/app" &&
		globalState.communities.length > 0
	) {
		navigate(`/c/${sortedCommunities()[0].rkey}`);
	}

	const [draggingOrder, setDraggingOrder] = createSignal<
		CommunityData[] | null
	>(null);
	const [draggedItem, setDraggedItem] = createSignal<CommunityData | undefined>(
		undefined,
	);

	const itemEls = new Map<string, HTMLElement>();
	const itemTops = new Map<string, number>();

	const reorder = (
		communities: CommunityData[],
		fromId: string | number,
		toId: string | number,
	) =>
		reorderList(
			communities,
			communities.findIndex((c) => c.rkey === fromId),
			communities.findIndex((c) => c.rkey === toId),
		);

	const onDragStart = ({ draggable }: DragEvent) => {
		setDraggedItem(
			globalState.communities.find((c) => c.rkey === draggable.id),
		);
	};

	const onDragOver = ({ draggable, droppable }: DragEvent) => {
		if (!draggable || !droppable) return;
		capturePositions(itemEls, itemTops);
		setDraggingOrder(reorder(sortedCommunities(), draggable.id, droppable.id));
		queueMicrotask(() => animateToNewPositions(itemEls, itemTops));
	};

	const onDragEnd = ({ draggable, droppable }: DragEvent) => {
		const finalOrder = draggingOrder();
		setDraggingOrder(null);
		setDraggedItem(undefined);
		if (!draggable || !droppable || !finalOrder) return;
		if (draggable.id === droppable.id) return;
		setCommunities(finalOrder);
	};

	return (
		<div class="flex flex-col w-screen h-screen bg-card">
			<div class="flex w-full h-10 min-h-10 justify-between">
				<div class="flex w-full h-full pl-2 items-center gap-2">
					<img
						src="/logo.png"
						width={32}
						height={32}
						alt="Colibri Social logo"
					/>
					<span class="font-black text-lg bg-clip-text text-transparent bg-[linear-gradient(69deg,#090615_-145.97%,#31226D_-87.27%,#6C5AA6_-26.22%,#AE99CB_30.13%,#E0DEEC_75.92%)]">
						colibri.social
					</span>
				</div>
				<div class="h-full pr-1 flex items-center">
					<Button
						size="sm"
						variant="ghost"
						class="w-8 h-8"
						onClick={() => setMemberListVisible((current) => !current)}
					>
						<Icon variant="regular" name="users-icon" />
					</Button>
				</div>
			</div>
			<div class="flex h-[calc(100%-40px)] w-full">
				<aside class="flex flex-col h-full w-14 p-2 pb-3">
					<nav class="w-full h-full flex flex-col gap-2">
						<div class="w-full h-full flex flex-col gap-2">
							<A
								href="/"
								class="w-10 flex h-10 rounded-md bg-muted hover:bg-primary hover:text-primary-foreground items-center justify-center cursor-pointer"
							>
								<Icon variant="regular" name="house-icon" />
							</A>
							<hr class="m-0 border-muted" />
							<DragDropProvider
								onDragStart={onDragStart}
								onDragOver={onDragOver}
								onDragEnd={onDragEnd}
								collisionDetector={closestCenter}
							>
								<CommunitySidebar
									communities={draggingOrder() ?? sortedCommunities()}
									draggedItem={draggedItem()}
									onItemRef={(rkey, el) => itemEls.set(rkey, el)}
								/>
							</DragDropProvider>

							<NewCommunityModal navigate={navigate}>
								<button
									type="button"
									class="w-10 flex h-10 rounded-md bg-muted hover:bg-primary hover:text-primary-foreground items-center justify-center cursor-pointer"
								>
									<Icon variant="regular" name="plus-icon" />
								</button>
							</NewCommunityModal>
						</div>
					</nav>
					<UserSettingsModal>
						<div class="w-10 flex h-10 rounded-md bg-muted hover:bg-primary hover:text-primary-foreground items-center justify-center cursor-pointer">
							<div class="block w-fit h-fit">
								<Icon variant="regular" name="gear-icon" />
							</div>
						</div>
					</UserSettingsModal>
				</aside>
				<main class="w-full h-full">{props.children}</main>
			</div>
		</div>
	);
};

export default AppLayout;
