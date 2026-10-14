import "./app.css";
import { render } from "solid-js/web";
import { App } from "./App";
import { installExternalLinkInterceptor } from "./native/open-external";

installExternalLinkInterceptor();

const root = document.getElementById("root");
if (root) render(() => <App />, root);
