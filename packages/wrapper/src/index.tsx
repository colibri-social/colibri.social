/* @refresh reload */
import { App, initSentry } from "@colibri-social/client";
import "@colibri-social/assets/fonts.css";
import "@colibri-social/client/index.css";

import { render } from "solid-js/web";

if (import.meta.env.PROD) {
	initSentry({
		dsn: import.meta.env.VITE_SENTRY_DSN,
		environment: "production",
	});
}

render(() => <App />, document.getElementById("root") as HTMLElement);
