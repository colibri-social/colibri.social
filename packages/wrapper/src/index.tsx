/* @refresh reload */
import { App } from "@colibri-social/client";
import "@colibri-social/assets/fonts.css";
import "@colibri-social/client/index.css";

import { render } from "solid-js/web";

render(() => <App />, document.getElementById("root") as HTMLElement);
