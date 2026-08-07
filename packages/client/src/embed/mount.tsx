import { render } from "solid-js/web";
import {
	communityUriToUrlCompatible,
	urlSegmentToUri,
} from "../atproto/community-uri-to-url-compatible";
import { ColibriError } from "../errors/error";
import { initSentry } from "../sentry";
import { AtURI } from "../utils/at-uri";
import { createLogger } from "../utils/logger";
import type { EmbedRuntime } from "./context";
import { EmbedApp } from "./EmbedApp";
import { createEmbedEmitter } from "./events";
import { activateEmbedRuntime, deactivateEmbedRuntime } from "./runtime";
import { applyBrand, applyTheme } from "./theme";
import type { ColibriEmbedConfig, EmbedHandle } from "./types";

export type {
	ColibriEmbedConfig,
	EmbedColorScheme,
	EmbedEvent,
	EmbedEventListener,
	EmbedHandle,
	EmbedMembershipState,
	EmbedRealtimeEvent,
	EmbedRealtimeEventType,
	EmbedThemeToken,
	EmbedThemeTokens,
} from "./types";
export { EMBED_THEME_TOKENS } from "./types";

const log = createLogger("embed");

const resolveCommunity = (
	input: string,
): { uri: string; segment: string; rkey: string } => {
	const uri = input.startsWith("at://") ? input : urlSegmentToUri(input);
	const parsed = AtURI.parseAtURI(uri);

	if (!parsed.did || parsed.collection !== "social.colibri.community") {
		throw new ColibriError({
			code: "EmbedConfigInvalid",
			message: `"${input}" is not a community. Pass an at:// URI or the did-rkey segment from a Colibri community URL.`,
		});
	}

	return {
		uri,
		segment: communityUriToUrlCompatible(
			uri as Parameters<typeof communityUriToUrlCompatible>[0],
		),
		rkey: parsed.identifier,
	};
};

export const mountColibri = (
	target: HTMLElement,
	config: ColibriEmbedConfig,
): EmbedHandle => {
	if (!config.agent?.did) {
		throw new ColibriError({
			code: "EmbedConfigInvalid",
			message:
				"`config.agent` must be a signed-in @atproto/api Agent. The embed does not sign users in.",
		});
	}

	if (config.colorScheme !== undefined && config.colorScheme !== "dark") {
		throw new ColibriError({
			code: "EmbedUnsupported",
			message:
				'The embed is dark-only for now. Omit `colorScheme` or set it to "dark".',
		});
	}

	const community = resolveCommunity(config.community);
	const emitter = createEmbedEmitter();
	if (config.onEvent) emitter.on(config.onEvent);

	activateEmbedRuntime({
		storagePrefix: config.storagePrefix ?? `colibri:embed:${community.rkey}:`,
		appViewUrl: config.appViewUrl,
		noiseAssetBase: config.noiseAssetBase,
	});

	if (config.sentry) initSentry(config.sentry);

	const root = document.createElement("div");
	root.className = "colibri-embed dark";
	root.dataset.theme = "dark";
	root.style.width = "100%";
	root.style.height = "100%";

	if (config.brand) applyBrand(root, config.brand, emitter);
	if (config.theme) applyTheme(root, config.theme);

	target.appendChild(root);

	const runtime: EmbedRuntime = {
		config,
		communityUri: community.uri,
		communitySegment: community.segment,
		emitter,
		root,
		goToChannel: undefined,
	};

	const dispose = render(() => <EmbedApp runtime={runtime} />, root);

	log.info("mounted", { community: community.segment });

	let live = true;

	return {
		unmount: () => {
			if (!live) return;
			live = false;
			dispose();
			root.remove();
			deactivateEmbedRuntime();
			log.info("unmounted", { community: community.segment });
		},
		navigate: (targetChannel) => {
			if (!runtime.goToChannel) {
				log.warn("navigate was called before the embed finished mounting");
				return;
			}
			runtime.goToChannel(targetChannel.channel);
		},
		setTheme: (theme) => applyTheme(root, theme),
		on: emitter.on,
	};
};
