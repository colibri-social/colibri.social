import { batch, createRoot, createSignal } from "solid-js";
import type { CreateCommunityInput, DataSource } from "./source";
import type {
	BridgeLink,
	BridgePairingView,
	BridgeRegistrationView,
	BridgeRemoteRoom,
	CommunityView,
	Did,
} from "./types";

type Updatable<T> = { update: (change: (current: T) => T) => void };

export type CreateSpaceRequest = CreateCommunityInput & {
	picture?: File;
	banner?: File;
};

export type CreateSpaceResult = {
	community: CommunityView;
	imagesFailed: boolean;
};

export const IMAGES_NOT_SAVED =
	"Your picture and banner weren't saved. You can set them in Manage Space.";

const replaceCommunity = (
	list: readonly CommunityView[],
	community: CommunityView,
) => list.map((entry) => (entry.did === community.did ? community : entry));

const createLoadable = <T>(fetch: () => Promise<T>) => {
	const [value, setValue] = createSignal<T>();
	const [loading, setLoading] = createSignal(false);
	const [failed, setFailed] = createSignal(false);
	let started = false;
	const refresh = () => {
		started = true;
		setLoading(value() === undefined);
		setFailed(false);
		return fetch().then(
			(result) =>
				batch(() => {
					setValue(() => result);
					setLoading(false);
				}),
			() =>
				batch(() => {
					setFailed(true);
					setLoading(false);
				}),
		);
	};
	const ensure = () => {
		if (!started) void refresh();
	};
	return {
		value: () => {
			ensure();
			return value();
		},
		loading: () => {
			ensure();
			return loading();
		},
		failed,
		refresh,
		update: (change: (current: T) => T) =>
			setValue((current) =>
				current === undefined ? current : change(current),
			),
	};
};

export type BridgeData = {
	registrations: () => BridgeRegistrationView[] | undefined;
	loading: () => boolean;
	failed: () => boolean;
	refresh: () => Promise<void>;
	find: (registration: string) => BridgeRegistrationView | undefined;
	rooms: (registration: string) => Promise<BridgeRemoteRoom[]>;
	lookUp: (code: string) => Promise<BridgePairingView>;
	connect: (code: string) => Promise<BridgeRegistrationView>;
	update: (
		registration: string,
		changes: {
			links?: BridgeLink[];
			enabled?: boolean;
			mirrorModeration?: boolean;
		},
	) => Promise<BridgeRegistrationView>;
	disconnect: (registration: string) => Promise<void>;
};

export const createSpaceDirectory = (
	source: DataSource,
	communities: Updatable<CommunityView[]>,
) =>
	createRoot(() => {
		const discoverable = createLoadable(() => source.listDiscoverable());
		const bridgeData = new Map<Did, BridgeData>();

		const remember = (community: CommunityView) => {
			communities.update((list) =>
				list.some((entry) => entry.did === community.did)
					? replaceCommunity(list, community)
					: [...list, community],
			);
			discoverable.update((list) => replaceCommunity(list, community));
		};

		source.subscribe((event) => {
			if (event.$type !== "communityEvent") return;
			if (event.event === "delete") {
				discoverable.update((list) =>
					list.filter((entry) => entry.did !== event.community.did),
				);
				return;
			}
			if (event.event === "create" && event.community.viewer.isMember) {
				remember(event.community);
				return;
			}
			discoverable.update((list) => replaceCommunity(list, event.community));
		});

		const create = async (
			request: CreateSpaceRequest,
		): Promise<CreateSpaceResult> => {
			const { picture, banner, ...input } = request;
			let community = await source.createCommunity(input);
			remember(community);
			let imagesFailed = false;
			for (const [kind, file] of [
				["picture", picture],
				["banner", banner],
			] as const) {
				if (!file) continue;
				try {
					community = await source.putCommunityImage({
						community: community.did,
						kind,
						file,
					});
					remember(community);
				} catch {
					imagesFailed = true;
				}
			}
			return { community, imagesFailed };
		};

		const join = async (community: Did) => {
			const result = await source.joinCommunity({ community });
			if (result.status === "pending") {
				discoverable.update((list) =>
					list.map((entry) =>
						entry.did === community
							? {
									...entry,
									viewer: { ...entry.viewer, applicationPending: true },
								}
							: entry,
					),
				);
			} else {
				const fresh = await source.getCommunity(community);
				remember(fresh);
			}
			return result;
		};

		const bridges = (community: Did): BridgeData => {
			const existing = bridgeData.get(community);
			if (existing) return existing;
			const list = createLoadable(() => source.listBridges(community));
			const replace = (registration: BridgeRegistrationView) =>
				list.update((entries) =>
					entries.some((entry) => entry.id === registration.id)
						? entries.map((entry) =>
								entry.id === registration.id ? registration : entry,
							)
						: [registration, ...entries],
				);
			const data: BridgeData = {
				registrations: list.value,
				loading: list.loading,
				failed: list.failed,
				refresh: list.refresh,
				find: (registration) =>
					list.value()?.find((entry) => entry.id === registration),
				rooms: (registration) =>
					source.listBridgeRooms({ community, registration }),
				lookUp: (code) => source.getBridgePairing(code),
				connect: async (code) => {
					const registration = await source.redeemBridgePairing({
						community,
						code,
					});
					replace(registration);
					return registration;
				},
				update: async (registration, changes) => {
					const next = await source.updateBridge({
						community,
						registration,
						...changes,
					});
					replace(next);
					return next;
				},
				disconnect: async (registration) => {
					await source.revokeBridge({ community, registration });
					list.update((entries) =>
						entries.filter((entry) => entry.id !== registration),
					);
				},
			};
			bridgeData.set(community, data);
			return data;
		};

		return {
			discoverable: {
				value: discoverable.value,
				loading: discoverable.loading,
				failed: discoverable.failed,
				refresh: discoverable.refresh,
			},
			create,
			join,
			bridges,
		};
	});

export type SpaceDirectory = ReturnType<typeof createSpaceDirectory>;
