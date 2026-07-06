# @colibri-social/standard-renderer

A rendering library for [standard.site](https://standard.site) documents.

It turns a `site.standard.document` record whose body is a Leaflet
`pub.leaflet.content` block tree into rendered output. It ships two layers:

- **Core**: framework-agnostic TypeScript: record/block/facet types, a UTF-8
  facet segmenter, block extraction, and blob-URL helpers. No runtime deps.
- **Astro**: optional prebuilt Astro components that render a document to HTML,
  used by the Colibri website. Consumers on other frameworks can build their own
  view on top of the core and ignore these.

## Install

Workspace-internal package:

```jsonc
// package.json
"dependencies": {
  "@colibri-social/standard-renderer": "workspace:"
}
```

The Astro components require `astro` (declared as a peer dependency) and expect
the consumer to have Tailwind with the typography plugin. They use Colibri
design tokens (`text-primary`, `bg-muted`, `border-border`, `prose`).

## Usage

### Astro

```astro
---
import { getLinearBlocks, blobUrl } from "@colibri-social/standard-renderer";
import LeafletDocument from "@colibri-social/standard-renderer/astro/LeafletDocument.astro";

// `doc` is a site.standard.document record value
const blocks = getLinearBlocks(doc);

// resolveBlob is injected so the package stays free of PDS/DID config
const resolveBlob = (blob) =>
  blobUrl(blob, { did: "did:plc:...", pds: "https://your.pds" });
---

<LeafletDocument blocks={blocks} resolveBlob={resolveBlob} />
```

### Core (any framework)

```ts
import {
  getLinearBlocks,
  segmentRichText,
  resolveSegmentStyle,
  blobUrl,
} from "@colibri-social/standard-renderer";

// Split a text/header/blockquote block's plaintext + facets into styled runs
for (const segment of segmentRichText(block.plaintext, block.facets)) {
  const { marks, href } = resolveSegmentStyle(segment.features);
  // render segment.text with marks (bold/italic/code/underline/...) and href
}
```

## Coverage

**Blocks:** text, header, blockquote, image, iframe, code, website, bskyPost,
horizontalRule, and (recursive) unorderedList. Unhandled block types are logged
via `console.warn` and skipped rather than throwing.

**Facet features:** link, bold, italic, code, underline, strikethrough,
highlight, atMention, didMention. Facets use `app.bsky.richtext.facet`-style
UTF-8 byte offsets; `@atproto/api`'s `RichText` does not recognise the Leaflet
feature `$type`s, which is why the segmenter is bundled here. Mentions resolve to
`https://bsky.app/profile/{did}` by default.

## Notes

- **Blob refs:** `@atproto/api` lex-decodes blobs into `BlobRef` instances whose
  `ref` is a `CID` object (no `$link`). `blobUrl` / `extractBlobCid` handle both
  the decoded `CID` shape and raw JSON `{ ref: { $link } }`.
- **`blobPages`:** large documents may store pages in a JSON blob
  (`content.blobPages`) instead of inline. This is detected and warned; decoding
  it is not yet implemented.
- The core imports use `.js` extension specifiers (NodeNext) and are consumed
  directly from `src/`. No build step is required for workspace consumers.
