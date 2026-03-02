import { A, useNavigate } from "@solidjs/router";
import { For, Match, type ParentComponent, Switch } from "solid-js";
import { NewCommunityModal } from "../components/NewCommunityModal";
import { useGlobalContext } from "../contexts/GlobalContext";
import { Gear } from "../icons/Gear";
import { House } from "../icons/House";
import { Plus } from "../icons/Plus";

const AppLayout: ParentComponent = (props) => {
	const [globalState] = useGlobalContext();
	const navigate = useNavigate();

	if (
		window.location.pathname === "/app" &&
		globalState.communities.length > 0
	) {
		navigate(`/c/${globalState.communities[0].rkey}`);
	}

	return (
		<div class="flex flex-col w-screen h-screen bg-card">
			<div class="flex w-full h-10 min-h-10 pl-2 items-center gap-2">
				<img src="/logo.png" width={32} height={32} alt="Colibri Social logo" />
				<span class="font-black text-lg bg-clip-text text-transparent bg-[linear-gradient(69deg,#090615_-145.97%,#31226D_-87.27%,#6C5AA6_-26.22%,#AE99CB_30.13%,#E0DEEC_75.92%)]">
					colibri.social
				</span>
			</div>
			<div class="flex h-full w-full">
				<aside class="flex flex-col h-full w-14 p-2 pb-3">
					<nav class="w-full h-full flex flex-col gap-2">
						<div class="w-full h-full flex flex-col gap-2">
							<div class="w-10 flex h-10 rounded-md bg-muted items-center justify-center cursor-pointer">
								<House />
							</div>
							<hr class="m-0 border-muted" />
							<For each={globalState.communities}>
								{(item) => {
									return (
										<A
											href={`/c/${item.rkey}`}
											class="w-10 h-10 rounded-md bg-muted flex items-center justify-center"
											activeClass="outline outline-foreground outline-2 -outline-offset-2"
										>
											<Switch>
												<Match when={item.picture}>
													<img
														src={item.picture}
														alt={item.name}
														class="w-10 h-10 rounded-md object-cover"
													/>
												</Match>
												<Match when={!item.picture}>
													<span class="font-bold">
														{item.name
															.split(" ")
															.map((x) => x.substring(0, 1))
															.join("")
															.substring(0, 3)}
													</span>
												</Match>
											</Switch>
										</A>
									);
								}}
							</For>
							<NewCommunityModal navigate={navigate}>
								<button
									type="button"
									class="w-10 flex h-10 rounded-md bg-muted items-center justify-center cursor-pointer"
								>
									<Plus />
								</button>
							</NewCommunityModal>
						</div>
					</nav>
					<div class="w-10 flex h-10 rounded-md bg-muted items-center justify-center cursor-pointer">
						<div class="block w-fit h-fit">
							<Gear />
						</div>
					</div>
				</aside>
				<main class="w-full h-full">{props.children}</main>
			</div>
		</div>
	);
};

export default AppLayout;
