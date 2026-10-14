import { createSignal } from "solid-js";
import type { SpaceRef } from "./types";

export type JumpRequest = { channel: SpaceRef; rkey: string };

export const createJumpRequests = () => {
	const [pending, setPending] = createSignal<JumpRequest>();
	return {
		pending,
		request: (next: JumpRequest) => setPending(next),
		take: (channel: SpaceRef) => {
			const current = pending();
			if (current?.channel !== channel) return undefined;
			setPending(undefined);
			return current.rkey;
		},
	};
};

export type JumpRequests = ReturnType<typeof createJumpRequests>;
