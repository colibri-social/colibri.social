import { For } from "solid-js";
import HeartIcon from "~icons/ph/heart";
import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "../../../src/components/ui/Alert";
import { Button } from "../../../src/components/ui/Button";
import { Separator } from "../../../src/components/ui/Separator";
import {
	Table,
	TableBody,
	TableCaption,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "../../../src/components/ui/Table";
import {
	Tabs,
	TabsContent,
	TabsIndicator,
	TabsList,
	TabsTrigger,
} from "../../../src/components/ui/Tabs";
import { Demo } from "../helpers";
import type { SandboxCategory } from "../types";

const BUTTON_VARIANTS = [
	"default",
	"destructive",
	"outline",
	"secondary",
	"ghost",
	"link",
] as const;

const TEXT_SIZES = ["default", "sm", "lg"] as const;
const ICON_SIZES = ["icon", "icon-sm", "icon-lg"] as const;

const ButtonDemo = () => (
	<For each={BUTTON_VARIANTS}>
		{(variant) => (
			<Demo label={variant}>
				<For each={TEXT_SIZES}>
					{(size) => (
						<Button variant={variant} size={size}>
							Button
						</Button>
					)}
				</For>
				<For each={ICON_SIZES}>
					{(size) => (
						<Button variant={variant} size={size}>
							<HeartIcon />
						</Button>
					)}
				</For>
				<Button variant={variant} disabled>
					Disabled
				</Button>
			</Demo>
		)}
	</For>
);

const AlertDemo = () => (
	<Demo label="Variants">
		<div class="flex w-full flex-col gap-3">
			<Alert>
				<AlertTitle>Default alert</AlertTitle>
				<AlertDescription>
					Something happened that you should know about.
				</AlertDescription>
			</Alert>
			<Alert variant="info">
				<AlertTitle>Info alert</AlertTitle>
				<AlertDescription>
					Something is worth pointing out here.
				</AlertDescription>
			</Alert>
			<Alert variant="destructive">
				<AlertTitle>Destructive alert</AlertTitle>
				<AlertDescription>Something went badly wrong.</AlertDescription>
			</Alert>
		</div>
	</Demo>
);

const SeparatorDemo = () => (
	<Demo label="Orientations">
		<div class="flex w-full flex-col gap-3">
			<span>Above the line</span>
			<Separator />
			<div class="flex h-6 items-center gap-3">
				<span>Left</span>
				<Separator orientation="vertical" />
				<span>Right</span>
			</div>
		</div>
	</Demo>
);

const TableDemo = () => (
	<Demo label="Table">
		<Table>
			<TableCaption>Recent activity.</TableCaption>
			<TableHeader>
				<TableRow>
					<TableHead>Member</TableHead>
					<TableHead>Role</TableHead>
					<TableHead>Joined</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				<TableRow>
					<TableCell>alice.example</TableCell>
					<TableCell>Owner</TableCell>
					<TableCell>2026-01-04</TableCell>
				</TableRow>
				<TableRow>
					<TableCell>bob.example</TableCell>
					<TableCell>Moderator</TableCell>
					<TableCell>2026-02-11</TableCell>
				</TableRow>
				<TableRow>
					<TableCell>carol.example</TableCell>
					<TableCell>Member</TableCell>
					<TableCell>2026-03-19</TableCell>
				</TableRow>
			</TableBody>
		</Table>
	</Demo>
);

const TabsDemo = () => (
	<Demo label="Tabs">
		<Tabs defaultValue="one" class="w-full">
			<TabsList class="w-full">
				<TabsTrigger value="one">One</TabsTrigger>
				<TabsTrigger value="two">Two</TabsTrigger>
				<TabsTrigger value="three">Three</TabsTrigger>
				<TabsIndicator />
			</TabsList>
			<TabsContent value="one" class="pt-3">
				Content of the first tab.
			</TabsContent>
			<TabsContent value="two" class="pt-3">
				Content of the second tab.
			</TabsContent>
			<TabsContent value="three" class="pt-3">
				Content of the third tab.
			</TabsContent>
		</Tabs>
	</Demo>
);

export const BASICS: SandboxCategory = {
	id: "basics",
	title: "Basics",
	items: [
		{ id: "button", title: "Button", component: ButtonDemo },
		{ id: "alert", title: "Alert", component: AlertDemo },
		{ id: "separator", title: "Separator", component: SeparatorDemo },
		{ id: "table", title: "Table", component: TableDemo },
		{ id: "tabs", title: "Tabs", component: TabsDemo },
	],
};
