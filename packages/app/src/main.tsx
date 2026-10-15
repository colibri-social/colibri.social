import "./app.css";
import { configureLogger } from "@colibri-social/lib";
import { render } from "solid-js/web";
import { App } from "./App";
import { installExternalLinkInterceptor } from "./native/open-external";
import { dismissDocumentLaunchScreen } from "./shell/launch/LaunchScreen";

configureLogger({ dev: import.meta.env.DEV });
installExternalLinkInterceptor();

const root = document.getElementById("root");
if (root) render(() => <App />, root);
dismissDocumentLaunchScreen();
