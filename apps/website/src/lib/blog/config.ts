export const BLOG_DID = "did:plc:mprdjqjluoswa7awzggaggj3";
export const BLOG_PDS = "https://colibri.social";

export const PUBLICATION_COLLECTION = "site.standard.publication";
export const DOCUMENT_COLLECTION = "site.standard.document";

export const PUBLICATION_RKEY = "3mfxcgv6u7c23";
export const PUBLICATION_URI = `at://${BLOG_DID}/${PUBLICATION_COLLECTION}/${PUBLICATION_RKEY}`;

export const BLOG_BASE_URL = "https://colibri.social/blog";

export const postUrl = (rkey: string) => `${BLOG_BASE_URL}/${rkey}`;
export const documentUri = (rkey: string) =>
	`at://${BLOG_DID}/${DOCUMENT_COLLECTION}/${rkey}`;
