export interface BlobRef {
	$type: "blob";
	ref: { $link: string };
	mimeType: string;
	size: number;
}

export interface AspectRatio {
	width: number;
	height: number;
}

export interface ByteSlice {
	byteStart: number;
	byteEnd: number;
}

export interface FacetFeature {
	$type: string;
	[key: string]: unknown;
}

export interface LinkFeature extends FacetFeature {
	$type: "pub.leaflet.richtext.facet#link";
	uri: string;
}

export interface AtMentionFeature extends FacetFeature {
	$type: "pub.leaflet.richtext.facet#atMention";
	atURI: string;
	href?: string;
}

export interface DidMentionFeature extends FacetFeature {
	$type: "pub.leaflet.richtext.facet#didMention";
	did: string;
}

export interface HighlightFeature extends FacetFeature {
	$type: "pub.leaflet.richtext.facet#highlight";
	color?: string;
}

export interface Facet {
	index: ByteSlice;
	features: FacetFeature[];
}

export interface TextBlock {
	$type: "pub.leaflet.blocks.text";
	plaintext: string;
	facets?: Facet[];
	textSize?: number;
}

export interface HeaderBlock {
	$type: "pub.leaflet.blocks.header";
	plaintext: string;
	level?: number;
	facets?: Facet[];
}

export interface BlockquoteBlock {
	$type: "pub.leaflet.blocks.blockquote";
	plaintext: string;
	facets?: Facet[];
}

export interface ImageBlock {
	$type: "pub.leaflet.blocks.image";
	image: BlobRef;
	aspectRatio?: AspectRatio;
	alt?: string;
	fullBleed?: boolean;
}

export interface IframeBlock {
	$type: "pub.leaflet.blocks.iframe";
	url: string;
	height?: number;
	aspectRatio?: AspectRatio;
}

export interface CodeBlock {
	$type: "pub.leaflet.blocks.code";
	plaintext: string;
	language?: string;
}

export interface WebsiteBlock {
	$type: "pub.leaflet.blocks.website";
	src: string;
	title?: string;
	description?: string;
	previewImage?: BlobRef;
}

export interface BskyPostBlock {
	$type: "pub.leaflet.blocks.bskyPost";
	postRef: { uri: string; cid: string };
}

export interface HorizontalRuleBlock {
	$type: "pub.leaflet.blocks.horizontalRule";
}

export interface ListItem {
	$type: "pub.leaflet.blocks.unorderedList#listItem";
	content: LeafBlock;
	children?: ListItem[];
	checked?: boolean;
}

export interface UnorderedListBlock {
	$type: "pub.leaflet.blocks.unorderedList";
	children: ListItem[];
}

export type LeafBlock =
	| TextBlock
	| HeaderBlock
	| BlockquoteBlock
	| ImageBlock
	| IframeBlock
	| CodeBlock
	| WebsiteBlock
	| BskyPostBlock
	| HorizontalRuleBlock
	| UnorderedListBlock
	| (FacetFeature & { $type: string });

export interface BlockWrapper {
	$type: "pub.leaflet.pages.linearDocument#block";
	block: LeafBlock;
	alignment?: string;
}

export interface LinearDocument {
	$type: "pub.leaflet.pages.linearDocument";
	id?: string;
	blocks: BlockWrapper[];
}

export interface LeafletContent {
	$type: "pub.leaflet.content";
	pages: LinearDocument[];
	blobPages?: BlobRef;
	blobs?: BlobRef[];
}

export interface StandardPublication {
	$type: "site.standard.publication";
	url: string;
	name: string;
	description?: string;
	icon?: BlobRef;
	[key: string]: unknown;
}

export interface StandardDocument {
	$type: "site.standard.document";
	site: string;
	title: string;
	publishedAt: string;
	updatedAt?: string;
	path?: string;
	description?: string;
	tags?: string[];
	coverImage?: BlobRef;
	textContent?: string;
	content?: LeafletContent | { $type: string; [key: string]: unknown };
	[key: string]: unknown;
}
