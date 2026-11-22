import { classifyThrown, createLogger } from "@colibri-social/lib";
import {
	type BlockedUser,
	BlockedUsers,
	formatTimestamp,
	toast,
} from "@colibri-social/ui";
import { createEffect, createSignal } from "solid-js";
import { displayNameOf } from "../../../data/adapters/authors";
import { useData } from "../../../data/store";
import type { Did, ProfileView } from "../../../data/types";
import type { Platform } from "../../../screen/platform";
import { BLOCK_TOAST_COPY } from "../../members/block-flow";

const log = createLogger("blocked-users");

const INVALID_HANDLE = "handle.invalid";

const BLOCKED_USERS_PAGE_COPY = {
	detail: (createdAt: string) => {
		return `Blocked ${formatTimestamp(createdAt, "relative", new Date(), "en")}`;
	},
} as const;

type BlockEntry = { subject: string; createdAt: string };

export default function BlockedUsersPage(_props: { platform: Platform }) {
	const data = useData();
	const [profiles, setProfiles] = createSignal<
		ReadonlyMap<string, ProfileView>
	>(new Map());
	const [unblocking, setUnblocking] = createSignal<
		ReadonlyMap<string, BlockEntry>
	>(new Map());
	const requested = new Set<string>();

	const load = async (did: string) => {
		try {
			const profile = await data.source.getProfile(did as Did);

			setProfiles((current) => new Map(current).set(did, profile));
		} catch (error) {
			requested.delete(did);
			log.warn("loading a blocked profile failed", {
				code: classifyThrown(error, { method: "actor.getProfile" }).code,
			});
		}
	};

	createEffect(() => {
		for (const block of data.preferences.blocks()) {
			if (requested.has(block.subject)) continue;

			requested.add(block.subject);
			void load(block.subject);
		}
	});

	const nameOf = (did: string) => {
		const profile = profiles().get(did);
		return profile ? displayNameOf(profile) : did;
	};

	const entries = () => {
		const blocks: BlockEntry[] = data.preferences.blocks();
		const listed = new Set(blocks.map((block) => block.subject));
		const leaving = [...unblocking().values()].filter(
			(block) => !listed.has(block.subject),
		);

		return [...blocks, ...leaving];
	};

	const users = (): BlockedUser[] => {
		return entries()
			.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
			.map((block) => {
				const profile = profiles().get(block.subject);
				const handle = profile?.handle;

				return {
					id: block.subject,
					name: nameOf(block.subject),
					handle: handle && handle !== INVALID_HANDLE ? handle : undefined,
					avatarSrc: profile?.avatar,
					detail: BLOCKED_USERS_PAGE_COPY.detail(block.createdAt),
					unblocking: unblocking().has(block.subject),
				};
			});
	};

	const setPending = (block: BlockEntry, pending: boolean) => {
		setUnblocking((current) => {
			const next = new Map(current);
			if (pending) next.set(block.subject, block);
			else next.delete(block.subject);
			return next;
		});
	};

	const unblock = async (did: string) => {
		const block = entries().find((entry) => entry.subject === did);
		if (!block || unblocking().has(did)) return;

		const name = nameOf(did);

		setPending(block, true);

		const saved = await data.preferences.setBlocked(did as Did, false);

		setPending(block, false);

		if (!saved) {
			toast.error(BLOCK_TOAST_COPY.unblockFailed(name));
			return;
		}

		toast.success(BLOCK_TOAST_COPY.unblocked(name));
	};

	return <BlockedUsers users={users()} onUnblock={(id) => void unblock(id)} />;
}
