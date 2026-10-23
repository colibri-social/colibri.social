import { classifyThrown, createLogger } from "@colibri-social/lib";
import {
	hostSignInAttention,
	type SpaceAttention,
	toast,
} from "@colibri-social/ui";
import { createSignal, onCleanup } from "solid-js";
import { isNativeShell } from "../../../auth/native";
import { communityHostingFor } from "../../../data/community-hosting";
import { describeError } from "../../../data/error-copy";
import { HostSignInError, prepareExternalTab } from "../../../data/hosting";
import type { DataStore } from "../../../data/store";
import type { CommunityView } from "../../../data/types";
import { openExternalUrl } from "../../../native/open-external";

const log = createLogger("host-sign-in");

export const signInFailureCopy = (
	error: HostSignInError,
	account: string,
): { title: string; description?: string } => {
	switch (error.failure) {
		case "wrongAccount":
			return {
				title: "That's a different account",
				description: `You signed in as ${error.signedInAs ?? "another account"}. Sign in as ${account}.`,
			};
		case "cancelled":
			return { title: "Signing in was cancelled" };
		case "spacesUnsupported":
			return {
				title: "That server can't host Spaces yet",
				description:
					"Its server needs Spaces support before Colibri can run the Space.",
			};
		default:
			return {
				title: "Signing in didn't work",
				description: "Try again in a moment.",
			};
	}
};

export const createHostSignIn = (data: DataStore) => {
	const hosting = communityHostingFor(data.source);
	const [busy, setBusy] = createSignal(false);
	let waiting: AbortController | undefined;
	onCleanup(() => waiting?.abort());

	const signIn = async (
		community: Pick<CommunityView, "did" | "name">,
		account: string,
	): Promise<boolean> => {
		if (busy()) return false;
		const tab = prepareExternalTab(openExternalUrl, isNativeShell());
		waiting?.abort();
		const controller = new AbortController();
		waiting = controller;
		setBusy(true);
		try {
			await hosting.reconnect({
				community: community.did,
				identifier: account,
				tab,
				signal: controller.signal,
			});
			toast.success(`${community.name} is connected again`);
			return true;
		} catch (error) {
			if (controller.signal.aborted) return false;
			tab.close();
			if (error instanceof HostSignInError) {
				const copy = signInFailureCopy(error, account);
				toast.error(copy.title, { description: copy.description });
				return false;
			}
			log.warn("reconnecting failed", { code: classifyThrown(error).code });
			const copy = describeError(error);
			toast.error(copy.title, { description: copy.description });
			return false;
		} finally {
			if (waiting === controller) setBusy(false);
		}
	};

	const attention = (community: CommunityView): SpaceAttention | undefined => {
		if (!community.viewer.isOwner) return undefined;
		const view = hosting.get(community.did)();
		if (!view?.needsSignIn) return undefined;
		return hostSignInAttention(community.name, view.account, () => {
			void signIn(community, view.account);
		});
	};

	return { busy, signIn, attention, hosting };
};
