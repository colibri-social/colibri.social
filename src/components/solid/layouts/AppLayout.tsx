import { A, useNavigate } from "@solidjs/router";
import { For, type ParentComponent } from "solid-js";
import { useGlobalContext } from "../contexts/GlobalContext";

const AppLayout: ParentComponent = (props) => {
	const [globalState] = useGlobalContext();
	const navigate = useNavigate();

	if (window.location.pathname === "/app") {
		navigate(`/c/${globalState.communities[0].rkey}`);
	}
	// params.community is the currently selected community's record id

	return (
		<div class="flex flex-col w-screen h-screen bg-neutral-900">
			<div class="flex w-full h-10 pl-2">
				Window Bar (hide on web? Or only hide action buttons?)
			</div>
			<div class="flex h-full w-full">
				<aside class="flex flex-col h-full w-14 p-2 pb-3">
					<nav class="w-full h-full flex flex-col gap-2">
						<div class="w-full h-full flex flex-col gap-2">
							<div class="w-10 flex h-10 rounded-md bg-neutral-700 items-center justify-center cursor-pointer">
								<div class="block w-fit h-fit">H</div>
							</div>
							<hr class="m-0 border-neutral-800" />
							<For each={globalState.communities}>
								{(item) => (
									<A
										href={`/c/${item.rkey}`}
										class="w-10 block h-10 rounded-md bg-white"
									/>
								)}
							</For>
							<div class="w-10 flex h-10 rounded-md bg-neutral-700 items-center justify-center cursor-pointer">
								<div class="block w-fit h-fit">+</div>
							</div>
						</div>
					</nav>
					<div class="w-10 flex h-10 rounded-md bg-neutral-700 items-center justify-center cursor-pointer">
						<div class="block w-fit h-fit">S</div>
					</div>
				</aside>
				<main class="w-full h-full">{props.children}</main>
			</div>
		</div>
	);
};

export default AppLayout;
