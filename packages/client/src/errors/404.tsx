import { useNavigate } from "@solidjs/router";
import { Button } from "../components/ui/Button";

export default function NotFound() {
	const navigate = useNavigate();

	return (
		<div class="w-full h-full flex flex-col items-center justify-center gap-3 px-6 text-center select-none">
			<h1 class="text-xl font-bold m-0">This page doesn't exist.</h1>
			<p class="text-sm text-muted-foreground m-0">
				The link may be broken, or whatever was here has been removed.
			</p>
			<Button
				variant="secondary"
				size="sm"
				onClick={() => navigate("/app", { replace: true })}
			>
				Back to Colibri
			</Button>
		</div>
	);
}
