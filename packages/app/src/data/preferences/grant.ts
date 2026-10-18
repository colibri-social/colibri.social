import { classifyThrown, colibri, createLogger } from "@colibri-social/lib";
import type { Transport } from "../remote/transport";
import { isMissingSpace, type PreferencesSpace } from "./remote";

const log = createLogger("preferences-grant");

const APPVIEW_RENEW_WINDOW_MS = 120_000;
const REGRANT_MARGIN_MS = 180_000;
const REGRANT_MIN_DELAY_MS = 30_000;
const REGRANT_RETRY_BASE_MS = 5_000;
const REGRANT_RETRY_MAX_MS = 120_000;

export const regrantDelay = (lifetimeMs: number): number =>
	Math.max(
		lifetimeMs - Math.max(REGRANT_MARGIN_MS, APPVIEW_RENEW_WINDOW_MS),
		REGRANT_MIN_DELAY_MS,
	);

export const regrantRetryDelay = (failures: number): number => {
	const capped = Math.min(
		REGRANT_RETRY_BASE_MS * 2 ** (failures - 1),
		REGRANT_RETRY_MAX_MS,
	);
	return capped * (0.8 + Math.random() * 0.4);
};

export const createPreferencesGrant = (input: {
	transport: Transport;
	space: PreferencesSpace;
}) => {
	const { transport, space } = input;

	const delegate = () =>
		transport.pdsQuery<{ token: string }>(
			"com.atproto.space.getDelegationToken",
			{ params: { space: space.space } },
		);

	const grant = async (): Promise<string | undefined> => {
		try {
			const delegation = await delegate().catch(async (error: unknown) => {
				if (!isMissingSpace(error)) throw error;
				await space.ensure();
				return delegate();
			});
			const result = await transport.procedure(
				colibri.actor.grantSpaceAccess.main,
				{ body: { space: space.space, delegationToken: delegation.token } },
			);
			return result.expiresAt;
		} catch (error) {
			log.warn("could not grant access to the preferences space", {
				code: classifyThrown(error, {
					method: colibri.actor.grantSpaceAccess.main.nsid,
				}).code,
			});
			return undefined;
		}
	};

	const start = () => {
		let timer: ReturnType<typeof setTimeout> | undefined;
		let stopped = false;
		let failures = 0;

		const run = () => {
			void grant().then((expiresAt) => {
				if (stopped) return;
				if (expiresAt) {
					failures = 0;
					timer = setTimeout(
						run,
						regrantDelay(new Date(expiresAt).getTime() - Date.now()),
					);
					return;
				}
				failures += 1;
				timer = setTimeout(run, regrantRetryDelay(failures));
			});
		};

		run();

		return () => {
			stopped = true;
			if (timer !== undefined) clearTimeout(timer);
		};
	};

	return { grant, start };
};
