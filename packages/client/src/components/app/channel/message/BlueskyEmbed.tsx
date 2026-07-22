import {
	AppBskyEmbedImages,
	AppBskyEmbedRecordWithMedia,
	type AppBskyFeedDefs,
	type AppBskyFeedPost,
	RichText,
} from "@atproto/api";
import { type Component, createResource, For, Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import ChatIcon from "~icons/ph/chat-circle";
import CheckCircleIcon from "~icons/ph/check-circle-fill";
import HeartIcon from "~icons/ph/heart";
import RepeatIcon from "~icons/ph/repeat";
import SealCheckIcon from "~icons/ph/seal-check-fill";
import { getBskyAlternativeClientInfo } from "../../../../atproto/bluesky-alternatives";
import {
	getPostDeduped,
	resolveHandleDeduped,
} from "../../../../atproto/bsky-post-cache";
import {
	type BskyPostRef,
	buildBskyPostUrl,
	buildBskyProfileUrl,
	rewriteBskyUrl,
} from "../../../../atproto/bsky-post-url";
import {
	getMuVerification,
	isMuTrustedVerifier,
} from "../../../../atproto/mu-verification";
import { resolveEmbedImage } from "../../../../atproto/resolve-blob";
import { useStableMedia } from "../../../../contexts/ScrollAnchor";
import { useUserPreferences } from "../../../../contexts/UserPreferences";
import { openExternalLink } from "../../../../utils/open-external-link";
import { Lightbox } from "../../common/Lightbox";

/**
 * Renders a native Bluesky post card for a recognized post permalink, fetching
 * the live post from the public Bluesky AppView. The permalink is rewritten to
 * the user's preferred Bluesky client (see UserPreferences).
 */
export const BlueskyEmbed: Component<{ uri: string; post: BskyPostRef }> = (
	props,
) => {
	const { preferences } = useUserPreferences();
	const stableMedia = useStableMedia();

	const [post] = createResource(
		() => props.post,
		async (ref): Promise<AppBskyFeedDefs.PostView | undefined> => {
			// getPostDeduped needs an at:// URI with a DID — resolve the handle first.
			let did = ref.authority;
			if (!did.startsWith("did:")) {
				const resolved = await resolveHandleDeduped(ref.authority);
				if (!resolved) return undefined;
				did = resolved;
			}

			const atUri = `at://${did}/app.bsky.feed.post/${ref.rkey}`;
			return getPostDeduped(atUri);
		},
	);

	const record = () => post()?.record as AppBskyFeedPost.Record | undefined;

	const postSegments = () => {
		const r = record();
		if (!r?.text) return [];
		return [...new RichText({ text: r.text, facets: r.facets }).segments()];
	};

	const verifiedIssuers = () => {
		const verification = post()?.author.verification;
		if (verification?.verifiedStatus !== "valid") return undefined;
		const names = verification.verifications
			.filter((v) => v.isValid)
			.map((v) => v.issuerDisplayName || v.issuerHandle);
		return names.length > 0 ? names.join(", ") : undefined;
	};

	const [muVerification] = createResource(
		() => post()?.author.did,
		(did) => getMuVerification(did),
	);

	const verifiedTitle = () => {
		const names: string[] = [];
		const bskyNames = verifiedIssuers();
		if (bskyNames) names.push(bskyNames);
		const mu = muVerification();
		if (mu) names.push(mu.issuerDisplayName || mu.issuerHandle);
		return names.length > 0 ? names.join(", ") : undefined;
	};

	const [isMuVerifier] = createResource(
		() => post()?.author.did,
		(did) => isMuTrustedVerifier(did),
	);

	const isTrustedVerifier = () =>
		post()?.author.verification?.trustedVerifierStatus === "valid" ||
		isMuVerifier() === true;

	const images = (): AppBskyEmbedImages.ViewImage[] => {
		const embed = post()?.embed;
		if (AppBskyEmbedImages.isView(embed)) return embed.images;
		if (
			AppBskyEmbedRecordWithMedia.isView(embed) &&
			AppBskyEmbedImages.isView(embed.media)
		) {
			return embed.media.images;
		}
		return [];
	};

	// Rewrite to the preferred client; prefer the resolved handle for a clean URL.
	const link = () =>
		buildBskyPostUrl(
			preferences().preferredBlueskyClient,
			post()?.author.handle ?? props.post.authority,
			props.post.rkey,
		);

	return (
		<div ref={stableMedia}>
			<Show when={post()}>
				{(p) => (
					<div
						class="flex flex-col gap-2 border border-border bg-card mb-2 rounded-md p-3 max-w-104"
						style={{
							"--hover": getBskyAlternativeClientInfo(
								preferences().preferredBlueskyClient,
							).color,
						}}
					>
						<div class="flex flex-row items-center gap-2 w-full justify-between">
							<div class="flex flex-row items-center gap-2 justify-between w-fit">
								<Show when={p().author.avatar}>
									{(avatar) => (
										<img
											src={resolveEmbedImage(avatar())}
											alt=""
											width={36}
											height={36}
											class="w-9 h-9 rounded-full bg-muted object-cover"
										/>
									)}
								</Show>
								<div class="flex flex-col leading-tight min-w-0">
									<span class="font-semibold text-sm truncate flex items-center gap-1">
										{p().author.displayName || p().author.handle}
										<Show
											when={isTrustedVerifier()}
											fallback={
												<Show when={verifiedTitle()}>
													{(title) => (
														<span
															title={title()}
															class="shrink-0 inline-flex text-(--hover)"
														>
															<CheckCircleIcon class="w-3.5 h-3.5" />
														</span>
													)}
												</Show>
											}
										>
											<span
												title="Trusted verifier"
												class="shrink-0 inline-flex text-(--hover)"
											>
												<SealCheckIcon class="w-3.5 h-3.5" />
											</span>
										</Show>
									</span>
									<span class="text-xs text-card-foreground/70 truncate">
										@{p().author.handle}
									</span>
								</div>
							</div>
							<a
								href={link()}
								target="_blank"
								rel="noreferrer"
								onClick={(e) => openExternalLink(link(), e)}
							>
								<Dynamic
									component={
										getBskyAlternativeClientInfo(
											preferences().preferredBlueskyClient,
										).icon
									}
									className="w-6 h-6 hover:text-(--hover)"
								/>
							</a>
						</div>

						<Show when={record()?.text}>
							<span class="text-sm whitespace-pre-wrap break-words text-card-foreground">
								<For each={postSegments()}>
									{(segment) => {
										if (segment.isMention() && segment.mention) {
											const mentionHref = buildBskyProfileUrl(
												preferences().preferredBlueskyClient,
												segment.mention.did,
											);
											return (
												<a
													href={mentionHref}
													target="_blank"
													rel="noreferrer"
													onClick={(e) => openExternalLink(mentionHref, e)}
													class="text-(--primary-hover) decoration-(--primary-hover) font-medium hover:underline inline"
												>
													{segment.text}
												</a>
											);
										}

										if (segment.isLink() && segment.link) {
											const href = rewriteBskyUrl(
												segment.link.uri,
												preferences().preferredBlueskyClient,
											);
											return (
												<a
													href={href}
													title={href}
													target="_blank"
													rel="noreferrer"
													onClick={(e) => openExternalLink(href, e)}
													class="text-(--primary-hover) decoration-(--primary-hover) font-medium hover:underline inline"
												>
													{segment.text}
												</a>
											);
										}

										if (segment.isTag() && segment.tag) {
											const href = `https://${
												getBskyAlternativeClientInfo(
													preferences().preferredBlueskyClient,
												).base
											}/search?q=${encodeURIComponent(`#${segment.tag.tag}`)}`;
											return (
												<a
													href={href}
													target="_blank"
													rel="noreferrer"
													onClick={(e) => openExternalLink(href, e)}
													class="text-(--primary-hover) decoration-(--primary-hover) font-medium hover:underline inline"
												>
													{segment.text}
												</a>
											);
										}

										return <>{segment.text}</>;
									}}
								</For>
							</span>
						</Show>

						<Show when={images().length > 0}>
							<div
								class="grid gap-1 mt-1"
								classList={{
									"grid-cols-1": images().length === 1,
									"grid-cols-2": images().length > 1,
								}}
							>
								<For each={images()}>
									{(img) => {
										const full = resolveEmbedImage(img.fullsize);
										return (
											<Lightbox src={full}>
												<img
													src={resolveEmbedImage(img.thumb)}
													alt={img.alt || ""}
													class="w-full h-auto max-h-72 object-cover rounded-sm bg-muted cursor-zoom-in"
												/>
											</Lightbox>
										);
									}}
								</For>
							</div>
						</Show>

						<div class="flex flex-row items-center gap-4 text-xs text-card-foreground/70 mt-1">
							<span class="flex items-center gap-1">
								<ChatIcon class="w-3.5 h-3.5" />
								{p().replyCount ?? 0}
							</span>
							<span class="flex items-center gap-1">
								<RepeatIcon class="w-3.5 h-3.5" />
								{p().repostCount ?? 0}
							</span>
							<span class="flex items-center gap-1">
								<HeartIcon class="w-3.5 h-3.5" />
								{p().likeCount ?? 0}
							</span>
							<span class="ml-auto">
								{new Date(p().indexedAt).toLocaleDateString()}
							</span>
						</div>
					</div>
				)}
			</Show>
		</div>
	);
};
