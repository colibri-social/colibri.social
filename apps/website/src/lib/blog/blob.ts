import {
	type BlobRef,
	blobUrl as coreBlobUrl,
} from "@colibri-social/standard-renderer";
import { BLOG_DID, BLOG_PDS } from "./config";

export const blobUrl = (
	blob?: BlobRef,
	did: string = BLOG_DID,
): string | undefined => coreBlobUrl(blob, { did, pds: BLOG_PDS });
