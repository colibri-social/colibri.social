import { createContext } from "solid-js";
import type { GlobalContextData, GlobalContextUtility } from "./types";

/**
 * The global context token. Kept in its own file so that HMR updates to the
 * provider or consumer modules do not re-execute `createContext` and produce a
 * new identity. As long as this file (and its only dependency, `types.ts`) are
 * not modified, the token remains stable across hot reloads.
 */
export const GlobalContext =
	createContext<[GlobalContextData, GlobalContextUtility]>();
