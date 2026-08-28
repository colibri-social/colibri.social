import {
	AppBskyEmbedGallery,
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
import {
	getBskyAlternativeClientInfo,
	getBskyClientAccentColor,
} from "../../../../atproto/bluesky-alternatives";
import { fetchPostByRef, peekPost } from "../../../../atproto/bsky-post-cache";
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
import { useUserPreferences } from "../../../../contexts/UserPreferences";
import { openUntrustedLink } from "../../../../utils/external-link-warning";
import { type GalleryImage, MediaLightboxGallery } from "./Attachments";

type BskyViewImage = {
	fullsize: string;
	alt?: string;
	aspectRatio?: { width: number; height: number };
};

const toGalleryImage = (thumb: string, image: BskyViewImage): GalleryImage => ({
	url: image.fullsize,
	thumbUrl: thumb,
	alt: image.alt,
	width: image.aspectRatio?.width,
	height: image.aspectRatio?.height,
});

const fromImagesView = (view: AppBskyEmbedImages.View): GalleryImage[] =>
	view.images.map((image) => toGalleryImage(image.thumb, image));

const fromGalleryView = (view: AppBskyEmbedGallery.View): GalleryImage[] =>
	view.items
		.filter(AppBskyEmbedGallery.isViewImage)
		.map((item) => toGalleryImage(item.thumbnail, item));

/**
 * Renders a native Bluesky post card for a recognized post permalink, fetching
 * the live post from the public Bluesky AppView. The permalink is rewritten to
 * the user's preferred Bluesky client (see UserPreferences).
 */
export const BlueskyEmbed: Component<{ uri: string; post: BskyPostRef }> = (
	props,
) => {
	const { preferences } = useUserPreferences();

	const [post] = createResource(
		() => props.post,
		(ref): Promise<AppBskyFeedDefs.PostView | undefined> =>
			fetchPostByRef(ref.authority, ref.rkey),
		{ initialValue: peekPost(props.post.authority, props.post.rkey) },
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

	const images = (): GalleryImage[] => {
		const embed = post()?.embed;

		if (AppBskyEmbedImages.isView(embed)) return fromImagesView(embed);
		if (AppBskyEmbedGallery.isView(embed)) return fromGalleryView(embed);

		if (AppBskyEmbedRecordWithMedia.isView(embed)) {
			const media = embed.media;
			if (AppBskyEmbedImages.isView(media)) return fromImagesView(media);
			if (AppBskyEmbedGallery.isView(media)) return fromGalleryView(media);
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

	const getLogoColor = () =>
		getBskyClientAccentColor(preferences().preferredBlueskyClient);

	return (
		<div>
			<Show when={post()}>
				{(p) => (
					<div
						class="flex flex-col gap-2 border border-border bg-card mb-2 rounded-md p-3 max-w-104"
						style={{
							"--hover": getLogoColor(),
						}}
					>
						<div class="flex flex-row items-center gap-2 w-full justify-between">
							<div class="flex flex-row items-center gap-2 justify-between w-fit">
								<Show when={p().author.avatar}>
									{(avatar) => (
										<img
											src={avatar()}
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
								class="group/northsky-logo"
								onClick={(e) => openUntrustedLink(link(), e)}
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
													onClick={(e) => openUntrustedLink(mentionHref, e)}
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
													onClick={(e) => openUntrustedLink(href, e)}
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
													onClick={(e) => openUntrustedLink(href, e)}
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
							<div class="mt-1">
								<MediaLightboxGallery
									images={images()}
									maxHeightClass="max-h-72"
								/>
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
