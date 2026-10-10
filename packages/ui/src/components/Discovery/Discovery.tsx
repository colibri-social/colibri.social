import { createSignal, createUniqueId, Show } from "solid-js";
import { cx } from "../../utils/cx";
import { Drawer, DrawerContent } from "../Drawer/Drawer";
import { NavHeader } from "../Header/NavHeader";
import { LargeModalContent, Modal } from "../Modal/Modal";
import { DiscoveryGrid } from "./DiscoveryGrid";
import type {
	DiscoveryActions,
	DiscoveryPlatform,
	DiscoverySpace,
} from "./discovery-model";
import { SpacePreview, SpacePreviewHeader } from "./SpacePreview";

export type DiscoveryProps = DiscoveryActions & {
	platform: DiscoveryPlatform;
	spaces: DiscoverySpace[];
	loading?: boolean;
	busyIds?: readonly string[];
	defaultSelectedId?: string;
	defaultQuery?: string;
	class?: string;
};

const DesktopDiscovery = (props: DiscoveryProps) => {
	const [query, setQuery] = createSignal(props.defaultQuery ?? "");
	const [selectedId, setSelectedId] = createSignal(props.defaultSelectedId);
	const selected = () =>
		props.spaces.find((space) => space.id === selectedId());
	let root: HTMLDivElement | undefined;

	const back = () => {
		const id = selectedId();
		setSelectedId(undefined);
		requestAnimationFrame(() =>
			root
				?.querySelector<HTMLElement>(`[data-space-id="${id}"] button`)
				?.focus(),
		);
	};

	return (
		<div ref={root} data-discovery="desktop" class={cx("min-w-0", props.class)}>
			<div hidden={!!selected()} data-discovery-results="">
				<DiscoveryGrid
					spaces={props.spaces}
					platform="desktop"
					query={query()}
					onQueryChange={setQuery}
					loading={props.loading}
					onSelect={(space) => setSelectedId(space.id)}
				/>
			</div>
			<Show when={selectedId()} keyed>
				{(id) => (
					<Show when={props.spaces.find((space) => space.id === id)}>
						{(space) => (
							<SpacePreview
								space={space()}
								busy={props.busyIds?.includes(id)}
								onJoin={props.onJoin}
								onRequestJoin={props.onRequestJoin}
								onOpenSpace={props.onOpenSpace}
								onBack={back}
							/>
						)}
					</Show>
				)}
			</Show>
		</div>
	);
};

const MobileDiscovery = (props: DiscoveryProps) => {
	const [query, setQuery] = createSignal(props.defaultQuery ?? "");
	const [shownId, setShownId] = createSignal(props.defaultSelectedId);
	const [open, setOpen] = createSignal(!!props.defaultSelectedId);
	const shown = () => props.spaces.find((space) => space.id === shownId());

	return (
		<div data-discovery="mobile" class={cx("min-w-0", props.class)}>
			<DiscoveryGrid
				spaces={props.spaces}
				platform="mobile"
				query={query()}
				onQueryChange={setQuery}
				loading={props.loading}
				onSelect={(space) => {
					setShownId(space.id);
					setOpen(true);
				}}
			/>
			<Drawer open={open()} onOpenChange={setOpen} initialFocus="content">
				<Show when={shown()}>
					{(space) => {
						const nameId = createUniqueId();
						return (
							<DrawerContent
								aria-label={space().name}
								header={
									<SpacePreviewHeader
										space={space()}
										nameId={nameId}
										busy={props.busyIds?.includes(space().id)}
										onJoin={props.onJoin}
										onRequestJoin={props.onRequestJoin}
										onOpenSpace={props.onOpenSpace}
									/>
								}
							/>
						);
					}}
				</Show>
			</Drawer>
		</div>
	);
};

export const Discovery = (props: DiscoveryProps) => (
	<Show
		when={props.platform === "mobile"}
		fallback={<DesktopDiscovery {...props} />}
	>
		<MobileDiscovery {...props} />
	</Show>
);

export type DiscoveryModalProps = Omit<DiscoveryProps, "platform"> & {
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	defaultOpen?: boolean;
	title?: string;
};

export const DiscoveryModal = (props: DiscoveryModalProps) => (
	<Modal
		open={props.open}
		onOpenChange={props.onOpenChange}
		defaultOpen={props.defaultOpen}
	>
		<LargeModalContent title={props.title ?? "Discover Spaces"}>
			<Discovery {...props} platform="desktop" />
		</LargeModalContent>
	</Modal>
);

export type DiscoveryScreenProps = Omit<DiscoveryProps, "platform"> & {
	title?: string;
	onBack?: () => void;
};

export const DiscoveryScreen = (props: DiscoveryScreenProps) => (
	<div
		data-discovery-screen=""
		class="flex h-full min-h-0 flex-col bg-background text-foreground"
	>
		<NavHeader
			title={props.title ?? "Discover Spaces"}
			onNavigate={props.onBack}
			safeTop
		/>
		<div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-2 pb-safe-offset-4">
			<Discovery {...props} platform="mobile" />
		</div>
	</div>
);
