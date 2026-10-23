import type { Did } from "./types";

export type HostingKind = "colibri" | "own";

export type HostingView = {
	kind: HostingKind;
	account: string;
	server: string;
	connectedBy?: Did;
	connectedAt?: string;
	needsSignIn: boolean;
	needsSignInSince?: string;
	handOverExpiresAt?: string;
};

export type HostSignInFailure =
	| "cancelled"
	| "wrongAccount"
	| "spacesUnsupported"
	| "alreadyHosts"
	| "failed";

export type HostAuthorization =
	| { status: "pending" }
	| { status: "done"; community: Did }
	| { status: "failed"; failure: HostSignInFailure; signedInAs?: string };

export type AuthorizeHostInput =
	| {
			intent: "adopt";
			identifier: string;
			name: string;
			description?: string;
			requiresApprovalToJoin?: boolean;
	  }
	| { intent: "reconnect"; identifier: string; community: Did };

export type AuthorizeHostResult = { authorizeUrl: string; request: string };

export type HandOverResult = {
	identifier: string;
	password: string;
	expiresAt: string;
};

export type HostingSource = {
	authorizeCommunityHost: (
		input: AuthorizeHostInput,
	) => Promise<AuthorizeHostResult>;
	getCommunityHostAuthorization: (
		request: string,
	) => Promise<HostAuthorization>;
	getCommunityHosting: (community: Did) => Promise<HostingView>;
	handOverCommunityHost: (input: {
		community: Did;
		email: string;
	}) => Promise<HandOverResult>;
};

const FAILURES = new Set<HostSignInFailure>([
	"cancelled",
	"wrongAccount",
	"spacesUnsupported",
	"alreadyHosts",
	"failed",
]);

export const toHostAuthorization = (wire: {
	status: string;
	community?: string;
	failure?: string;
	signedInAs?: string;
}): HostAuthorization => {
	if (wire.status === "done" && wire.community) {
		return { status: "done", community: wire.community as Did };
	}
	if (wire.status === "failed") {
		const failure = FAILURES.has(wire.failure as HostSignInFailure)
			? (wire.failure as HostSignInFailure)
			: "failed";
		return {
			status: "failed",
			failure,
			...(wire.signedInAs ? { signedInAs: wire.signedInAs } : {}),
		};
	}
	return { status: "pending" };
};

export class HostSignInError extends Error {
	constructor(
		readonly failure: HostSignInFailure,
		readonly signedInAs?: string,
	) {
		super(`host sign-in ended with ${failure}`);
		this.name = "HostSignInError";
	}
}

const POLL_MS = 2_000;

export const waitForHostAuthorization = (
	source: Pick<HostingSource, "getCommunityHostAuthorization">,
	request: string,
	options: { signal?: AbortSignal; intervalMs?: number } = {},
): Promise<HostAuthorization & { status: "done" | "failed" }> =>
	new Promise((resolve, reject) => {
		let timer: ReturnType<typeof setTimeout> | undefined;
		let checking = false;
		let finished = false;

		const finish = () => {
			finished = true;
			clearTimeout(timer);
			globalThis.window?.removeEventListener("focus", check);
			globalThis.document?.removeEventListener("visibilitychange", check);
			options.signal?.removeEventListener("abort", abort);
		};

		const abort = () => {
			finish();
			reject(new HostSignInError("cancelled"));
		};

		const schedule = () => {
			clearTimeout(timer);
			timer = setTimeout(check, options.intervalMs ?? POLL_MS);
		};

		async function check() {
			if (finished || checking) return;
			checking = true;
			try {
				const result = await source.getCommunityHostAuthorization(request);
				if (finished) return;
				if (result.status !== "pending") {
					finish();
					resolve(result);
					return;
				}
			} catch (error) {
				if (finished) return;
				finish();
				reject(error);
				return;
			} finally {
				checking = false;
			}
			schedule();
		}

		if (options.signal?.aborted) {
			abort();
			return;
		}
		options.signal?.addEventListener("abort", abort);
		globalThis.window?.addEventListener("focus", check);
		globalThis.document?.addEventListener("visibilitychange", check);
		schedule();
	});

export type ExternalTab = {
	go: (url: string) => void;
	close: () => void;
};

export const prepareExternalTab = (
	open: (url: string) => void,
	native: boolean,
): ExternalTab => {
	if (native) return { go: open, close: () => {} };
	const tab = window.open("about:blank", "_blank");
	if (tab) tab.opener = null;
	return {
		go: (url) => {
			if (tab && !tab.closed) tab.location.href = url;
			else open(url);
		},
		close: () => {
			if (tab && !tab.closed) tab.close();
		},
	};
};
