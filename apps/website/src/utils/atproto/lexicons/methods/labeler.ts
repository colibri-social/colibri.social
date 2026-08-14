import type { LexiconDoc } from "@atproto/lexicon";

export const labelerMethodDocs: LexiconDoc[] = [
	{
		lexicon: 1,
		id: "social.colibri.labeler.linkExternalAccount",
		revision: 1,
		defs: {
			main: {
				type: "procedure",
				description:
					"Starts linking the calling account to an account on an external funding platform, so the labeler can issue supporter badges automatically. Returns the platform's authorization URL, which the client opens in a browser. The caller's identity comes from service auth (aud = the labeler's did with the `#atproto_labeler` fragment, lxm = this method), and the returned URL carries a signed, short-lived state token binding the flow to that DID. On success the labeler publishes a `social.colibri.labeler.attestation` record and evaluates the subject's entitlements immediately. This grants no privileged access: any authenticated account may link itself, and only itself.",
				input: {
					encoding: "application/json",
					schema: {
						type: "object",
						required: ["platform"],
						properties: {
							platform: {
								type: "string",
								description: "The external platform to link.",
								knownValues: ["opencollective"],
							},
							native: {
								type: "boolean",
								description:
									"True when the caller is a native app that expects the completed flow to hand back control over a custom URL scheme rather than a web redirect.",
							},
						},
					},
				},
				output: {
					encoding: "application/json",
					schema: {
						type: "object",
						required: ["authorizeUrl"],
						properties: {
							authorizeUrl: {
								type: "string",
								format: "uri",
								description:
									"Where to send the user to authorize the link. Single use and short lived.",
							},
						},
					},
				},
				errors: [
					{
						name: "AuthRequired",
						description: "Missing, malformed, or unverifiable service auth.",
					},
					{
						name: "InvalidRequest",
						description: "A parameter was missing or malformed.",
					},
					{
						name: "NotEnabled",
						description:
							"This labeler is not configured to link the requested platform.",
					},
				],
			},
		},
	},
	{
		lexicon: 1,
		id: "social.colibri.labeler.unlinkExternalAccount",
		revision: 1,
		defs: {
			main: {
				type: "procedure",
				description:
					"Removes the link between the calling account and an external funding platform. Deletes the `social.colibri.labeler.attestation` record and negates any badge the link was the basis for. Authorized the same way as `social.colibri.labeler.linkExternalAccount`, so an account can only unlink itself.",
				input: {
					encoding: "application/json",
					schema: {
						type: "object",
						required: ["platform"],
						properties: {
							platform: {
								type: "string",
								description: "The external platform to unlink.",
								knownValues: ["opencollective"],
							},
						},
					},
				},
				output: {
					encoding: "application/json",
					schema: {
						type: "object",
						required: ["unlinked"],
						properties: {
							unlinked: {
								type: "boolean",
								description:
									"False when there was no link to remove, which is not an error.",
							},
							negatedLabelVals: {
								type: "array",
								description: "Badge values revoked as part of unlinking.",
								items: { type: "string", maxLength: 100 },
							},
						},
					},
				},
				errors: [
					{
						name: "AuthRequired",
						description: "Missing, malformed, or unverifiable service auth.",
					},
					{
						name: "InvalidRequest",
						description: "A parameter was missing or malformed.",
					},
				],
			},
		},
	},
];
