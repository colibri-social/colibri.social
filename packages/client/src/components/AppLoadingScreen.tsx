import { Component } from "solid-js";

export const AppLoadingScreen: Component<{ message?: string }> = (props) => {
	return (
		<div class="w-screen h-screen absolute top-0 left-0 z-50 flex items-center justify-center text-white">
			{props.message ?? "Loading..."}
		</div>
	);
};
