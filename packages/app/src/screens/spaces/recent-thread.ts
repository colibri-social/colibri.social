import { type Accessor, createSignal, type Setter } from "solid-js";
import type { DataStore } from "../../data/store";

export type RecentThread = { space: string; channel: string; thread: string };

type RecentSignal = [
	Accessor<RecentThread | undefined>,
	Setter<RecentThread | undefined>,
];

const sameThread = (a?: RecentThread, b?: RecentThread) =>
	a === b ||
	(!!a &&
		!!b &&
		a.space === b.space &&
		a.channel === b.channel &&
		a.thread === b.thread);

const recentByStore = new WeakMap<DataStore, RecentSignal>();

const recentSignal = (data: DataStore) => {
	const existing = recentByStore.get(data);
	if (existing) return existing;
	const created = createSignal<RecentThread | undefined>(undefined, {
		equals: sameThread,
	});
	recentByStore.set(data, created);
	return created;
};

export const recentThread = (data: DataStore) => recentSignal(data)[0]();

export const rememberThread = (data: DataStore, thread: RecentThread) => {
	recentSignal(data)[1]({
		space: thread.space,
		channel: thread.channel,
		thread: thread.thread,
	});
};
