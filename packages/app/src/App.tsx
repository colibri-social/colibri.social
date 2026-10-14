import { lazy, Show, Suspense } from "solid-js";
import { createMockSource } from "./data/mock/source";
import { createDataStore, DataContext } from "./data/store";
import { installNativeCall } from "./native/call";
import { Providers } from "./providers";
import { usePlatform } from "./screen/platform";
import { MobileShell } from "./shell/MobileShell";

const DesktopShell = lazy(() =>
	import("./shell/desktop/DesktopShell").then((module) => ({
		default: module.DesktopShell,
	})),
);

const store = createDataStore(createMockSource());

installNativeCall(store);

export const App = () => {
	const platform = usePlatform();
	return (
		<DataContext.Provider value={store}>
			<Providers>
				<Show when={platform() === "desktop"} fallback={<MobileShell />}>
					<Suspense>
						<DesktopShell />
					</Suspense>
				</Show>
			</Providers>
		</DataContext.Provider>
	);
};
