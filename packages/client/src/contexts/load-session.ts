export type LoadSession<T> = {
	generation: number;
	key: string;
	supersededSignal: AbortSignal;
	state: T;
};

export type LoadSessions<T> = {
	begin: (key: string) => LoadSession<T>;
	current: () => LoadSession<T> | undefined;
	isCurrent: (session: LoadSession<T>) => boolean;
	abortCurrent: () => void;
	dispose: () => void;
	teardownSignal: AbortSignal;
};

export const createLoadSessions = <T>(
	initialState: () => T,
): LoadSessions<T> => {
	const teardown = new AbortController();
	let generation = 0;
	let controller: AbortController | undefined;
	let session: LoadSession<T> | undefined;

	const abortCurrent = (): void => {
		controller?.abort();
		controller = undefined;
		session = undefined;
	};

	const begin = (key: string): LoadSession<T> => {
		abortCurrent();
		generation += 1;
		controller = new AbortController();
		session = {
			generation,
			key,
			supersededSignal: controller.signal,
			state: initialState(),
		};
		return session;
	};

	return {
		begin,
		current: () => session,
		isCurrent: (candidate) => session?.generation === candidate.generation,
		abortCurrent,
		dispose: () => {
			abortCurrent();
			teardown.abort();
		},
		teardownSignal: teardown.signal,
	};
};
