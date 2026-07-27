import "../src/index.css";

import { render } from "solid-js/web";

import { SandboxRoot } from "./sandbox/SandboxRoot";

const root = document.getElementById("root");

if (!(root instanceof HTMLElement)) {
	throw new Error("Root element not found.");
}

render(() => <SandboxRoot />, root);
