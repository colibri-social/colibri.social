import type { social } from "@colibri-social/lexicons";
import {
	ColibriError,
	classifyThrown,
	colibri,
	createLogger,
} from "@colibri-social/lib";
import { createSignal } from "solid-js";
import type { Transport } from "../remote/transport";

type GetStatusOutput = social.colibri.beta.polyfill.getStatus.$OutputBody;

type MigrationProgress = social.colibri.beta.polyfill.defs.MigrationProgress;

export type HostMode = "polyfill" | "migrating" | "native";

const log = createLogger("polyfill/host");

export type HostStatus = {
	mode: HostMode;
	pdsSupportsSpaces: boolean;
	migration?: MigrationProgress;
};

export type HostRoute = "pds" | "appview";

const NATIVE_FALLBACK: HostStatus = { mode: "native", pdsSupportsSpaces: true };

const KNOWN_MODES = new Set<string>(["polyfill", "migrating", "native"]);

const [shownStatus, setShownStatus] = createSignal<HostStatus>();

export const hostingStatus = shownStatus;

export const isHostedByAppView = (mode: HostMode | undefined) => {
	return mode === "polyfill" || mode === "migrating";
};

const unknownCodeOf = (error: ColibriError) => {
	const code = error.context.unknownCode;

	return typeof code === "string" ? code : undefined;
};

export const isHostMismatch = (error: unknown) => {
	if (!(error instanceof ColibriError)) return false;
	if (error.code === "SpacesUnsupported") return true;
	if (error.status === 501) return true;

	const unknownCode = unknownCodeOf(error);

	return (
		unknownCode === "RepoNotHosted" || unknownCode === "MethodNotImplemented"
	);
};

export const isRepoNotHosted = (error: unknown) => {
	return (
		error instanceof ColibriError && unknownCodeOf(error) === "RepoNotHosted"
	);
};

export const isRecordMissing = (error: unknown) => {
	if (!(error instanceof ColibriError)) return false;
	if (error.code === "NotFound") return true;

	return unknownCodeOf(error) === "RecordNotFound";
};

const normalize = (output: GetStatusOutput): HostStatus => {
	const mode = KNOWN_MODES.has(output.mode)
		? (output.mode as HostMode)
		: "native";

	return {
		mode,
		pdsSupportsSpaces: output.pdsSupportsSpaces === true,
		...(output.migration ? { migration: output.migration } : {}),
	};
};

export const createHostMode = (input: {
	transport: Transport;
	publish?: boolean;
}) => {
	const [status, setStatus] = createSignal<HostStatus>();
	const listeners = new Set<(status: HostStatus) => void>();
	const movedSpaces = new Set<string>();
	let inFlight: Promise<HostStatus> | undefined;

	const apply = (next: HostStatus) => {
		if (next.mode !== "migrating") movedSpaces.clear();

		setStatus(next);

		if (input.publish) setShownStatus(next);

		for (const listener of listeners) listener(next);
	};

	const fetchStatus = async () => {
		try {
			const output = await input.transport.query(
				colibri.polyfill.getStatus.main,
				{ attempts: 1 },
			);
			const next = normalize(output);

			apply(next);

			return next;
		} catch (error) {
			log.warn("could not read where the account's data lives", {
				code: classifyThrown(error, {
					method: colibri.polyfill.getStatus.main.nsid,
				}).code,
			});

			return status() ?? NATIVE_FALLBACK;
		}
	};

	const refresh = () => {
		inFlight ??= fetchStatus().finally(() => {
			inFlight = undefined;
		});

		return inFlight;
	};

	const resolved = async () => {
		return status() ?? (await refresh());
	};

	const route = async (space?: string): Promise<HostRoute> => {
		const current = await resolved();

		if (space && current.mode === "migrating" && movedSpaces.has(space)) {
			return "pds";
		}

		return isHostedByAppView(current.mode) ? "appview" : "pds";
	};

	const markMoved = (space: string) => {
		if (status()?.mode === "migrating") movedSpaces.add(space);
	};

	const subscribe = (listener: (status: HostStatus) => void) => {
		listeners.add(listener);

		return () => {
			listeners.delete(listener);
		};
	};

	const dispose = () => {
		listeners.clear();

		if (input.publish) setShownStatus(undefined);
	};

	return {
		status,
		mode: () => status()?.mode,
		refresh,
		resolved,
		route,
		markMoved,
		apply,
		subscribe,
		dispose,
	};
};

export type HostModeSignal = ReturnType<typeof createHostMode>;
