import type { Component } from "solid-js";

export type SandboxItem = {
	id: string;
	title: string;
	component: Component;
};

export type SandboxCategory = {
	id: string;
	title: string;
	items: Array<SandboxItem>;
};
