import "./app.css";
import { configureLogger } from "@colibri-social/lib";
import { render } from "solid-js/web";
import { App } from "./App";
import { installExternalLinkInterceptor } from "./native/open-external";
import { installQuitGuard } from "./native/quit-guard";
import { installUpdater } from "./native/updater";
import { initSentry, logBreadcrumb } from "./sentry/init";
import { dismissDocumentLaunchScreen } from "./shell/launch/LaunchScreen";

if (import.meta.env.PROD) {
	initSentry({
		dsn: import.meta.env.VITE_SENTRY_DSN,
		release: import.meta.env.VITE_APP_VERSION,
	});
}
configureLogger({ dev: import.meta.env.DEV, breadcrumb: logBreadcrumb });
installExternalLinkInterceptor();
installQuitGuard();
installUpdater();

const root = document.getElementById("root");
if (root) render(() => <App />, root);
dismissDocumentLaunchScreen();
